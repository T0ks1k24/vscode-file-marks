# Changelog

All notable changes to File Marks are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0]

### Added
- **Keybindings.** `Ctrl+Alt+1` … `Ctrl+Alt+5` apply the first five presets, `Ctrl+Alt+0` removes the
  mark, `Ctrl+Alt+M` opens the preset picker, `Ctrl+Alt+C` the colours and `Ctrl+Alt+L` the list of
  marks. They work on the file open in the editor and on the Explorer selection.
- The shortcuts are bound to key positions (`[Digit1]`, `[KeyM]`) rather than to letters, so they
  also work on layouts that have no Latin letters — a `alt+m` binding cannot even be resolved while
  a Ukrainian or Russian layout is active.
- **`fileMarks.apply`** takes arguments, so any mark fits on a key of your own — `color` (short name,
  theme colour id or `null`), `badge`, `description`, `preset` (position or label), `toggle` and
  `target`. Combine them freely; leave `args` out and the key opens the picker.
- Pressing a shortcut a second time takes the mark back off. `"toggle": false` in the arguments
  keeps it on.
- `fileMarks.explorerKeybindings` (`true`) decides whether the shortcuts may act on the Explorer
  selection. VS Code exposes no API for it, so it is read through the built-in *Copy Path* command
  with the clipboard restored right after; turning the setting off keeps the shortcuts to the editor
  and never touches the clipboard.

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
