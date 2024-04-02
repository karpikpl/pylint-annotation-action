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

    core.info(`conclusion of linting: ${conclusion}`)

    const octokit = github.getOctokit(token)

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
            : 'Pylint has some suggestions!',
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
