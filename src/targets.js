'use strict';

const vscode = require('vscode');
const path = require('path');

/**
 * Written to the clipboard before the probe below, so "nothing was copied" is
 * told apart from "the path copied is the one that was already there". Copy Path
 * only ever writes absolute paths, so this can never be its answer.
 */
const PROBE_SENTINEL = 'file-marks probe — nothing was copied';

/**
 * Rebuilds a uri from the plain path `copyFilePath` puts on the clipboard. In a
 * remote or virtual workspace that path belongs to the workspace's file system,
 * not to the local disk, so the scheme and authority are taken from the folder
 * that contains it — otherwise the mark would be stored under a key no other
 * part of the extension ever produces.
 *
 * @param {string} text
 */
function pathToUri(text) {
  for (const folder of vscode.workspace.workspaceFolders || []) {
    if (folder.uri.scheme === 'file') continue;
    const base = folder.uri.path.endsWith('/') ? folder.uri.path.slice(0, -1) : folder.uri.path;
    if (text === base || text.startsWith(`${base}/`)) {
      return folder.uri.with({ path: text, query: '', fragment: '' });
    }
  }
  return vscode.Uri.file(text);
}

/**
 * What the Explorer has selected. VS Code exposes no API for it, so we ask the
 * built-in **Copy Path** command — which reads the focused tree, multi-selection
 * included — and read the answer off the clipboard. The previous clipboard
 * content is put back in every case, including on failure.
 *
 * Only reached from a keybinding pressed with the Explorer focused; the context
 * menu hands us the uris directly and never comes through here.
 *
 * @returns {Promise<vscode.Uri[]>}
 */
async function explorerSelection() {
  const clipboard = vscode.env.clipboard;
  /** @type {string | undefined} */
  let saved;

  try {
    saved = await clipboard.readText();
    await clipboard.writeText(PROBE_SENTINEL);
    await vscode.commands.executeCommand('copyFilePath');

    const copied = await clipboard.readText();
    if (copied === PROBE_SENTINEL) return [];

    return copied
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(pathToUri);
  } catch (err) {
    // No clipboard access, or the command is gone — fall back to the editor.
    return [];
  } finally {
    if (saved !== undefined) {
      try {
        await clipboard.writeText(saved);
      } catch (err) {
        // Nothing sensible to do; the path is still on the clipboard.
      }
    }
  }
}

/**
 * Works out what a command was invoked on: an Explorer multi-selection, a
 * single context-menu item, the Explorer selection behind a keybinding, or the
 * active editor.
 *
 * The first argument is a uri when the command comes from a menu and the
 * keybinding's `args` object when it comes from a key, so anything that is not
 * a uri is read as options.
 *
 * @param {unknown} uri
 * @param {unknown} uris
 * @returns {Promise<vscode.Uri[]>}
 */
async function resolveTargets(uri, uris) {
  if (Array.isArray(uris) && uris.length > 0) {
    const resolved = uris.filter((u) => u instanceof vscode.Uri);
    if (resolved.length > 0) return resolved;
  }
  if (uri instanceof vscode.Uri) return [uri];

  const options = uri && typeof uri === 'object' ? /** @type {any} */ (uri) : {};
  if (options.target === 'explorer') {
    const selected = await explorerSelection();
    if (selected.length > 0) return selected;
  }

  const active = vscode.window.activeTextEditor;
  if (active) return [active.document.uri];
  return [];
}

/** @param {readonly vscode.Uri[]} uris */
function describeTargets(uris) {
  if (uris.length === 1) {
    const uri = uris[0];
    return path.basename(uri.scheme === 'file' ? uri.fsPath : uri.path);
  }
  return `${uris.length} items`;
}

/**
 * @param {unknown} uri
 * @param {unknown} uris
 * @param {(targets: vscode.Uri[]) => Promise<void> | void} fn
 */
async function withTargets(uri, uris, fn) {
  const targets = await resolveTargets(uri, uris);
  if (targets.length === 0) {
    vscode.window.showWarningMessage('File Marks: no file or folder selected.');
    return;
  }
  await fn(targets);
}

module.exports = { describeTargets, withTargets };
