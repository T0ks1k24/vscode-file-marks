'use strict';

const vscode = require('vscode');
const path = require('path');

/** Ideographic space — keeps untagged rows aligned with tagged ones. */
const PAD = '　';

/**
 * Opens a file, reveals a folder, and says so when the item is gone.
 * @param {vscode.Uri | undefined} uri
 * @param {number} [line] 1-based, for a marked line rather than a whole file
 */
async function openMark(uri, line) {
  if (!uri) {
    vscode.window.showWarningMessage('File Marks: that mark is not part of this workspace.');
    return;
  }
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
      const target = store.uri(key);
      // `Uri.path` is always `/`-separated, so it beats reading the key itself:
      // a Windows key is a windows path, and the workspace root's key is `.`.
      const name = target ? path.posix.basename(target.path) : path.basename(key);

      if (mark.color || mark.tag || mark.description) {
        items.push({
          // The full tag, not the two-character badge the Explorer is limited to.
          label: `${mark.tag || PAD}  ${name}`,
          description: mark.description || '',
          detail: key,
          target,
        });
      }

      for (const [at, line] of Object.entries(mark.lines || {})) {
        items.push({
          label: `${PAD}  ${name}:${at}`,
          description: line.color.replace('fileMarks.', ''),
          detail: key,
          target,
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
