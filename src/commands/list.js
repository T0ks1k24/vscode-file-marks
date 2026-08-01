'use strict';

const vscode = require('vscode');
const path = require('path');

const { keyToUri } = require('../keys');

/** Ideographic space — keeps untagged rows aligned with tagged ones. */
const PAD = '　';

/**
 * Opens a file, reveals a folder, and says so when the item is gone.
 * @param {vscode.Uri} uri
 */
async function openMark(uri) {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type & vscode.FileType.Directory) {
      await vscode.commands.executeCommand('revealInExplorer', uri);
    } else {
      await vscode.window.showTextDocument(uri, { preview: true });
    }
  } catch (err) {
    const label = uri.scheme === 'file' ? uri.fsPath : uri.toString();
    vscode.window.showWarningMessage(`File Marks: ${label} no longer exists.`);
  }
}

/**
 * @param {(id: string, handler: (...args: any[]) => any) => void} register
 * @param {import('../markStore').MarkStore} store
 */
function registerListCommand(register, store) {
  register('fileMarks.list', async () => {
    const entries = store.entries();
    if (entries.length === 0) {
      vscode.window.showInformationMessage('File Marks: nothing marked yet.');
      return;
    }

    const items = entries
      .map(([key, mark]) => ({
        // The full tag, not the two-character badge the Explorer is limited to.
        label: `${mark.tag || PAD}  ${path.basename(key)}`,
        description: mark.description || '',
        detail: key,
        target: keyToUri(key),
      }))
      .sort((a, b) => a.detail.localeCompare(b.detail));

    const picked = await vscode.window.showQuickPick(items, {
      title: `Marks (${items.length})`,
      placeHolder: 'Enter to open or reveal',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!picked) return;

    await openMark(picked.target);
  });
}

module.exports = { registerListCommand };
