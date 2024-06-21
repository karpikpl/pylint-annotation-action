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

    const annotations = linting.messages.map(result => {
      return {
        path: result.path,
        start_line: result.line,
        end_line: result.endLine || result.line,
        annotation_level: toConvention(result.type),
        message: result.message,
        start_column: result.column,
        end_column: result.endColumn || result.column
      }
    })
    const conclusion = pylintResultCode === 0 ? 'success' : 'failure'

    const numAnnotations = annotations.length
    core.info(`number of annotations: ${numAnnotations}`)
    let trimmedWarning = ''
    if (numAnnotations > 50) {
      core.warning(
        `Number of annotations is greater than 50, only the first 50 will be displayed.`
      )
      annotations = annotations.slice(0, 50)
      trimmedWarning =
        '\n:warning: Pylint annotations have been limited to 50 due to api limitations.'
    }

    core.info(`conclusion of linting: ${conclusion}`)

    const octokit = github.getOctokit(token)

    let title = 'No issues have been found!'
    if (conclusion !== 'success') {
      title = 'Pylint has some suggestions!'
    }

    let summary = 'No issues have been found!'
    if (conclusion !== 'success') {
      summary = 'Pylint has some suggestions!' + trimmedWarning
    }

    const resp = await octokit.rest.checks.create({
      owner: repo_owner,
      repo: repo_name,
      name: 'pylint',
      head_sha: headSha,
      completed_at: new Date().toISOString(),
      conclusion,
      status: 'completed',
      output: {
        title: title,
        summary: summary,
        annotations
      }
    })
    core.debug(`response from checks create: ${resp.status}`)
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
