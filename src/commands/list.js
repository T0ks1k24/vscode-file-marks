'use strict';

const vscode = require('vscode');
const path = require('path');

const { keyToUri } = require('../keys');

/** Ideographic space — keeps untagged rows aligned with tagged ones. */
const PAD = '　';

/**
 * Opens a file, reveals a folder, and says so when the item is gone.
 * @param {vscode.Uri} uri
 * @param {number} [line] 1-based, for a marked line rather than a whole file
 */
async function openMark(uri, line) {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type & vscode.FileType.Directory) {
      await vscode.commands.executeCommand('revealInExplorer', uri);
      return;
    }

    const editor = await vscode.window.showTextDocument(uri, { preview: true });
    if (line === undefined) return;

    const at = new vscode.Position(Math.max(0, Math.min(line, editor.document.lineCount) - 1), 0);
    editor.selection = new vscode.Selection(at, at);
    editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.InCenter);
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

    const items = [];
    for (const [key, mark] of entries) {
      if (mark.color || mark.tag || mark.description) {
        items.push({
          // The full tag, not the two-character badge the Explorer is limited to.
          label: `${mark.tag || PAD}  ${path.basename(key)}`,
          description: mark.description || '',
          detail: key,
          target: keyToUri(key),
        });
      }

      for (const [at, line] of Object.entries(mark.lines || {})) {
        items.push({
          label: `${PAD}  ${path.basename(key)}:${at}`,
          description: line.color.replace('fileMarks.', ''),
          detail: key,
          target: keyToUri(key),
          line: Number(at),
        });
      }
    }
    if (items.length === 0) {
      vscode.window.showInformationMessage('File Marks: nothing marked yet.');
      return;
    }

    items.sort((a, b) => a.detail.localeCompare(b.detail) || (a.line || 0) - (b.line || 0));

    const picked = await vscode.window.showQuickPick(items, {
      title: `Marks (${items.length})`,
      placeHolder: 'Enter to open or reveal',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!picked) return;

    await openMark(picked.target, picked.line);
  });
}

module.exports = { registerListCommand };
