const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
async function run() {
  try {
    const lintFile = core.getInput('lint-file', { required: true })
    const pylintResultCode = +core.getInput('pylint-result-code', {
      required: true
    })
    const headSha = core.getInput('head-sha', { required: true })
    const token = core.getInput('repo-token')
    const repo_owner = core.getInput('repo-owner')
    const repo_name = core.getInput('repo-name')

    // read summary file
    const lintingJson = fs.readFileSync(lintFile, 'utf8')
    const linting = JSON.parse(lintingJson)
    let trimmedWarning = ''

    // limit the number of annotations to 50
    if (linting.messages.length > 50) {
      core.warning(
        `Number of annotations is greater than 50, only the first 50 will be displayed.`
      )
      trimmedWarning =
        '\n:warning: Pylint annotations have been limited to 50 due to api limitations.'
      linting.messages = linting.messages.slice(0, 50)
    }

    const annotations = linting.messages.map(result => {
      const annotation = {
        path: result.path,
        start_line: result.line,
        end_line: result.endLine || result.line,
        annotation_level: toConvention(result.type),
        message: result.message,
        start_column: result.column,
        end_column: result.endColumn || result.column
      }

      // Annotations only support start_column and end_column on the same line.
      // Omit this parameter if start_line and end_line have different values. Column numbers start at 1.
      if (annotation.start_line !== annotation.end_line) {
        delete annotation.start_column
        delete annotation.end_column
      }

      return annotation
    })
    const conclusion = pylintResultCode === 0 ? 'success' : 'failure'

    core.info(`conclusion of linting: ${conclusion}`)

    const octokit = github.getOctokit(token)

    try {
      core.debug(`Creating check for repo:${repo_name} owner:${repo_owner}`)
      const resp = await octokit.rest.checks.create({
        owner: repo_owner,
        repo: repo_name,
        name: 'pylint',
        head_sha: headSha,
        completed_at: new Date().toISOString(),
        conclusion,
        status: 'completed',
        output: {
          title:
            conclusion === 'success'
              ? 'No issues have been found!'
              : 'Pylint has some suggestions!',
          summary:
            conclusion === 'success'
              ? 'No issues have been found!'
              : `Pylint has some suggestions!'${trimmedWarning}'`,
          annotations
        }
      })
      core.debug(`response from checks create: ${resp.status}`)
    } catch (checkError) {
      core.error(`Error creating checks: ${checkError}`)

      const comment = annotations
        .map(
          annotation =>
            `::${annotation.annotation_level} file=${annotation.path},line=${annotation.start_line},col=${annotation.start_column}::${annotation.message}`
        )
        .join('\n')

      const issueNumber =
        github.context?.payload?.pull_request?.number ||
        github.context?.issue?.number
      if (issueNumber) {
        core.debug(
          `Trying to add a comment instead for repo:${repo_name} owner:${repo_owner} issue:${issueNumber}`
        )
        const commentResp = await octokit.rest.issues.createComment({
          owner: repo_owner,
          repo: repo_name,
          issue_number: issueNumber,
          body: comment
        })
        core.debug(`response from comment create: ${commentResp.status}`)
      }
    }

    core.setOutput('result', 'Success')
  } catch (error) {
    // Fail the workflow run if an error occurs
    core.setFailed(error.message)
    core.setOutput('result', 'Failure')
  }
}

function toConvention(c) {
  switch (c) {
    case 'convention':
      return 'notice'
    case 'error':
      return 'failure'
    case 'warning':
      return 'warning'
    default:
      return 'notice'
  }
}

module.exports = {
  run
}
