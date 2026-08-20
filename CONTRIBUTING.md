# Contributing

Bugs and ideas are welcome in the [issues](https://github.com/T0ks1k24/vscode-file-marks/issues).
Pull requests are welcome too — this page is only about the practical details.

## Running it

There is no build step. Clone it, `npm install`, then press `F5`: a second VS Code window opens with
the extension loaded. Two launch configurations are offered —

- **Extension (clean profile)** keeps its own global storage, so the marks you make while testing
  never touch the ones your everyday editor has. Start here.
- **Extension (my profile)** uses your real marks, which is what you want when reproducing a report.

```bash
npm run check      # syntax check, the same one CI runs
npm run package    # build file-marks-explorer.vsix
```

Every pull request gets a CI run that does both and uploads the `.vsix` as an artifact, so a
reviewer can install the change without building it.

## Where things are

| | |
|---|---|
| [src/markStore.js](src/markStore.js) | the one JSON file everything is kept in, and everything that guards it |
| [src/decorationProvider.js](src/decorationProvider.js) | what the Explorer draws on a file name |
| [src/lineDecorations.js](src/lineDecorations.js) | the stripe beside the line numbers |
| [src/decorationPriority.js](src/decorationPriority.js) | staying in front of the git colours |
| [src/targets.js](src/targets.js) | working out which files a command was invoked on |
| [src/markArgs.js](src/markArgs.js) | reading the `args` of a keybinding |
| [src/commands/](src/commands/) | one file per group of commands |

## What the code expects of itself

- **Plain JavaScript, no dependencies at runtime, no network access, no telemetry.** The
  `devDependencies` are the packaging tools and the type definitions, nothing else.
- **Nothing from the storage file is trusted.** It is user editable and can arrive through *Import*,
  so `markStore.js` sanitises every field it reads and drops anything it does not recognise. New
  fields belong in `normalizeMark`, not in the code that consumes them.
- **The Explorer asks for a decoration for every visible row.** `provideFileDecoration` does no
  configuration lookups and no parsing; settings are read once per change instead.
- **A tag is at most two characters.** That is the editor's limit, not ours: it throws away the whole
  decoration, colour included, when the badge is longer.
- Comments say *why*, not what the line already says.

## Releases

Maintainer only: bump `version` in `package.json`, add the matching `## [x.y.z]` section to
`CHANGELOG.md`, and push to `main`. The
[release workflow](.github/workflows/release.yml) tags the commit, creates the GitHub release with
the changelog section as its notes, and publishes to the Marketplace and Open VSX. It does nothing
when the tag for that version already exists.

So a version bump in a pull request would publish on merge — leave `version` alone and it will be
part of the next release.
