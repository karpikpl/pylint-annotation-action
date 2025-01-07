# Annotate code with pylint linting results

[![GitHub Super-Linter](https://github.com/karpikpl/pylint-annotation-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/karpikpl/pylint-annotation-action/actions/workflows/ci.yml/badge.svg)

GitHub Action that annotates code with pylint linting results captured using
`pylint *.py --output-format=json2:pylint.json`.

## Usage

Recommended usage with
[Pylint action](https://github.com/marketplace/actions/pylint-annotation-action)

### Basic

You need to add permissions for this tool.

```yaml
permissions:
  contents: read
  checks: write
```

```yaml
uses: karpikpl/pylint-annotation-action@1.1.0
with:
  lint-file: pylint.json
  pylint-result-code: 0
  head-sha: abcd1234
```

## Inputs

### `head-sha`

**Optional** SHA of the commit to annotate. Defaults to `github.sha` - current
commit.

### `lint-file`

**Optional** Linting JSON results file from Pylint. Defaults to `pylint.json`

### `pylint-result-code`

**Optional** Pylint result code to consider as an error. Defaults to `0`.

### `repo-owner`

**Optional** Another repository owner, If not set, the current repository owner
is used by default. Note that when you trying changing a repository, be aware
that `GITHUB_TOKEN` should also have permission for that repository.

### `repo-name`

**Optional** Another repository name. Of limited use on GitHub enterprise. If
not set, the current repository is used by default. Note that when you trying
changing a repository, be aware that `GITHUB_TOKEN` should also have permission
for that repository.

### `repo-token`

**Optional**, You can set
[PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)
here. If not set, this will use `${{ github.token }}`.

## Outputs

### `result`

The result of the action. Success, Failure or information message. Useful for
debugging.
