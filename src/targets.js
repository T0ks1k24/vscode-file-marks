'use strict';

const vscode = require('vscode');
const path = require('path');

/**
 * Works out what a command was invoked on: an Explorer multi-selection, a
 * single context-menu item, or — from the Command Palette — the active editor.
 *
 * @param {unknown} uri
 * @param {unknown} uris
 * @returns {vscode.Uri[]}
 */
function resolveTargets(uri, uris) {
  if (Array.isArray(uris) && uris.length > 0) {
    const resolved = uris.filter((u) => u instanceof vscode.Uri);
    if (resolved.length > 0) return resolved;
  }
  if (uri instanceof vscode.Uri) return [uri];

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
  const targets = resolveTargets(uri, uris);
  if (targets.length === 0) {
    vscode.window.showWarningMessage('File Marks: no file or folder selected.');
    return;
  }
  await fn(targets);
}

module.exports = { describeTargets, withTargets };
