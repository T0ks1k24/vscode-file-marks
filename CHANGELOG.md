# Changelog

All notable changes to File Marks are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.1]

### Fixed
- The repository, issues and homepage links pointed at a GitHub account that does not exist, which
  also left the screenshot in this page broken.

## [1.0.0]

First release.

- Mark any file or folder in the Explorer with a **colour**, a **tag** and a **hover note**, from
  the context menu, an editor tab or the Command Palette. Multi-selection is supported.
- **Quick Preset…** applies colour, tag and note in one click. The eight presets that ship with the
  extension can be replaced through `fileMarks.presets`.
- A tag is 1-2 characters, counted the way the editor counts them, so a multi-code-point emoji such
  as `🇺🇦` or `🗄️` is one character and `🚧✅` fits. Longer input is cut to the first two. Two is a
  hard limit of the VS Code decoration API: it rejects a longer badge and drops the colour with it.
- 10 themeable colours, overridable through `workbench.colorCustomizations`.
- Marks live in one JSON file in the extension's global storage, so they follow you into every
  project. Nothing is written into your workspaces.
- Several VS Code windows stay in sync — the storage file is watched, and the extension recognises
  its own writes by content.
- Renames and moves made inside VS Code carry their marks along, including everything inside a
  renamed folder.
- Mark colours stay in front of git decorations; `fileMarks.priorityOverGit` turns that off.
- **Export / Import**, **List All Marks**, **Remove Marks of Missing Files**, **Delete All Marks**
  and **Open the Marks Storage File**.
- Works in untrusted and virtual workspaces. No runtime dependencies, no network access.
