/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs')
const main = require('../src/main')

// Mock the GitHub Actions core library
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

const pylintData = fs.readFileSync(
  './__tests__/pylint-unittesting.json',
  'utf8'
)
const pylintCleanData = fs.readFileSync('./__tests__/pylintClean.json', 'utf8')
const readFileSyncMock = jest
  .spyOn(fs, 'readFileSync')
  .mockImplementation(name => {
    switch (name) {
      case 'pylintClean.json':
        return pylintCleanData
      case 'pylint-unittesting.json':
        return pylintData
      case 'large-pylint.json':
        return JSON.stringify({
          messages: Array.from({ length: 100 }, (_, i) => ({
            type: 'convention',
            symbol: 'missing-final-newline',
            message: 'Final newline missing',
            messageId: 'C0304',
            confidence: 'UNDEFINED',
            module: 'module',
            obj: '',
            line: i,
            column: 0,
            endLine: null,
            endColumn: null,
            path: 'app/module.py',
            absolutePath:
              '/home/pkarpala/projects/github/pr-changes/app/module.py'
          }))
        })
    }
  })

const createChecksMock = jest.fn().mockResolvedValue({
  status: 200,
  headers: {},
  data: {}
})

const createCommentMock = jest.fn().mockResolvedValue({
  status: 200,
  headers: {},
  data: {}
})

const getOctokitMock = jest
  .spyOn(github, 'getOctokit')
  .mockImplementation(() => {
    return {
      rest: {
        checks: {
          create: createChecksMock
        },
        issues: {
          createComment: createCommentMock
        }
      }
    }
  })

const mockInput = ({
  lint_file = 'pylint-unittesting.json',
  pylint_rc = 1,
  head_sha = 'abcdef',
  repo_token = 'abcdef',
  repo_owner = 'repoBoss',
  repo_name = 'myRepo'
} = {}) => {
  getInputMock.mockImplementation(name => {
    switch (name) {
      case 'lint-file':
        return lint_file
      case 'pylint-result-code':
        return pylint_rc
      case 'head-sha':
        return head_sha
      case 'repo-token':
        return repo_token
      case 'repo-owner':
        return repo_owner
      case 'repo-name':
        return repo_name
      default:
        throw new Error(`Unknown input: ${name}`)
    }
  })
}

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('posts pylint annotations', async () => {
    // Set the action's inputs as return values from core.getInput()
    const headSha = 'abc123'
    mockInput({ pylint_rc: 1, head_sha: headSha })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    const check = createChecksMock.mock.calls[0][0]

    expect(check.conclusion).toBe('failure')
    expect(check.head_sha).toBe(headSha)
    expect(createChecksMock).toHaveBeenCalled()
    expect(getOctokitMock).toHaveBeenCalled()
    expect(readFileSyncMock).toHaveBeenCalledWith(
      'pylint-unittesting.json',
      'utf8'
    )
    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'result', 'Success')
  })

  it('posts max 50 pylint annotations', async () => {
    // Set the action's inputs as return values from core.getInput()
    mockInput({ lint_file: 'large-pylint.json' })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    const check = createChecksMock.mock.calls[0][0]
    const annotations = check.output.annotations

    expect(annotations).toHaveLength(50)
  })

  it('posts valid pylint annotations', async () => {
    // Set the action's inputs as return values from core.getInput()
    mockInput({ lint_file: 'pylint-unittesting.json' })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    const check = createChecksMock.mock.calls[0][0]
    const annotations = check.output.annotations

    expect(annotations).toHaveLength(12)

    // Annotations only support start_column and end_column on the same line.
    // Omit this parameter if start_line and end_line have different values. Column numbers start at 1.
    const annotationsOnDifferentLines = annotations.filter(
      annotation =>
        annotation.start_line !== annotation.end_line &&
        (annotation.start_column || annotation.end_column)
    )
    expect(annotationsOnDifferentLines).toHaveLength(0)
  })

  it('posts no pylint annotations when code is OK', async () => {
    // Set the action's inputs as return values from core.getInput()
    mockInput({ pylint_rc: 0, lint_file: 'pylintClean.json' })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    const check = createChecksMock.mock.calls[0][0]

    expect(check.conclusion).toBe('success')
    expect(createChecksMock).toHaveBeenCalled()
    expect(getOctokitMock).toHaveBeenCalled()
    expect(readFileSyncMock).toHaveBeenCalledWith('pylintClean.json', 'utf8')
    expect(setOutputMock).toHaveBeenNthCalledWith(1, 'result', 'Success')
  })

  it('creates a comment when github checks API fails', async () => {
    // Set the action's inputs as return values from core.getInput()
    mockInput()
    github.context = {
      payload: { pull_request: { number: 123 } },
      issue: { number: 123 }
    }
    createChecksMock.mockRejectedValue(new Error('Failed to create check'))

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that comment was created
    expect(createCommentMock).toHaveBeenCalled()
  })

  it('doesnt set failed status when github fails', async () => {
    // Set the action's inputs as return values from core.getInput()
    mockInput()
    createChecksMock.mockRejectedValue(new Error('Failed to create check'))
    createCommentMock.mockRejectedValue(new Error('Failed to create comment'))

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenCalledTimes(0)
  })

  it('fails if no pylint file provided', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'lint-file':
          throw new Error('Input required and not supplied: lint-file')
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'Input required and not supplied: lint-file'
    )
  })
})
