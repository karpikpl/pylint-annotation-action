/**
 * Unit tests for the action's main functionality, src/main.js
 */
const core = require('@actions/core')
const github = require('@actions/github')
const fs = require('fs')
const main = require('../src/main')

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug').mockImplementation()
const getInputMock = jest.spyOn(core, 'getInput').mockImplementation()
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation()
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation()

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

const pylintData = fs.readFileSync('./__tests__/pylint.json', 'utf8')
const readFileSyncMock = jest
  .spyOn(fs, 'readFileSync')
  .mockImplementation(name =>
    name === 'pylint-unittesting.json' ? pylintData : ''
  )

const createChecksMock = jest.fn().mockResolvedValue({
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

  it('sets a failed status', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation(name => {
      switch (name) {
        case 'milliseconds':
          return 'this is not a number'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(setFailedMock).toHaveBeenNthCalledWith(
      1,
      'milliseconds not a number'
    )
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
