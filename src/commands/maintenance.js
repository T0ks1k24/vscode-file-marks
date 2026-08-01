'use strict';

const vscode = require('vscode');

const { keyToUri } = require('../keys');

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/**
 * @param {(id: string, handler: (...args: any[]) => any) => void} register
 * @param {import('../markStore').MarkStore} store
 */
function registerMaintenanceCommands(register, store) {
  register('fileMarks.clearAll', async () => {
    if (store.size === 0) {
      vscode.window.showInformationMessage('File Marks: nothing marked yet.');
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      `Delete all marks (${store.size})?`,
      { modal: true },
      'Delete'
    );
    if (answer !== 'Delete') return;

    await store.replaceAll({});
    vscode.window.showInformationMessage('File Marks: all marks deleted.');
  });

  register('fileMarks.prune', async () => {
    const stale = [];
    for (const [key] of store.entries()) {
      const uri = keyToUri(key);
      // Only file systems we can actually reach right now; a disconnected
      // remote must never look like a deleted file.
      if (uri.scheme !== 'file') continue;
      try {
        await vscode.workspace.fs.stat(uri);
      } catch (err) {
        stale.push(key);
      }
    }
    if (stale.length === 0) {
      vscode.window.showInformationMessage('File Marks: every marked item still exists.');
      return;
    }

    const answer = await vscode.window.showWarningMessage(
      `Remove marks for ${stale.length} missing item(s)?`,
      { modal: true, detail: stale.slice(0, 20).join('\n') },
      'Remove'
    );
    if (answer !== 'Remove') return;

    await store.removeKeys(stale);
    vscode.window.showInformationMessage(`File Marks: removed ${stale.length}.`);
  });

  register('fileMarks.export', async () => {
    const target = await vscode.window.showSaveDialog({
      title: 'Export marks',
      filters: { JSON: ['json'] },
      saveLabel: 'Export',
    });
    if (!target) return;

    const body = JSON.stringify(store.toPlainObject(), null, 2);
    await vscode.workspace.fs.writeFile(target, encoder.encode(body));
    vscode.window.showInformationMessage(`File Marks: exported ${store.size} mark(s).`);
  });

  register('fileMarks.import', async () => {
    const picked = await vscode.window.showOpenDialog({
      title: 'Import marks',
      canSelectMany: false,
      filters: { JSON: ['json'] },
      openLabel: 'Import',
    });
    if (!picked || picked.length === 0) return;

    let incoming;
    try {
      const bytes = await vscode.workspace.fs.readFile(picked[0]);
      incoming = JSON.parse(decoder.decode(bytes));
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        throw new Error('expected an object of path → mark');
      }
    } catch (err) {
      vscode.window.showErrorMessage(`File Marks: could not read that file — ${err.message}`);
      return;
    }

    const mode = await vscode.window.showQuickPick(
      [
        { label: 'Merge', description: 'keep existing marks, imported ones win on conflict', merge: true },
        { label: 'Replace', description: 'drop existing marks and use the file', merge: false },
      ],
      { title: `Import ${Object.keys(incoming).length} mark(s)` }
    );
    if (!mode) return;

    const next = mode.merge ? Object.assign(store.toPlainObject(), incoming) : incoming;
    await store.replaceAll(next);
    vscode.window.showInformationMessage(`File Marks: ${store.size} mark(s) now.`);
  });

  register('fileMarks.openStorage', async () => {
    await store.save();
    await vscode.window.showTextDocument(store.file);
  });
}

module.exports = { registerMaintenanceCommands };
