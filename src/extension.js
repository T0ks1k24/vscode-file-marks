'use strict';

const vscode = require('vscode');

const { MarkStore } = require('./markStore');
const { MarkDecorationProvider } = require('./decorationProvider');
const { LineDecorations } = require('./lineDecorations');
const { DecorationPriority } = require('./decorationPriority');
const { registerCommands } = require('./commands');
const { STORAGE_FILE } = require('./constants');

/** Milliseconds to let the Git extension finish its initial repository scan. */
const GIT_SETTLE_DELAY = 1500;

/**
 * Keeps the marks of several VS Code windows in sync by watching the shared
 * storage file. Our own writes are recognised by content and ignored.
 *
 * @param {vscode.ExtensionContext} context
 * @param {MarkStore} store
 * @param {MarkDecorationProvider} provider
 */
async function watchStorage(context, store, provider) {
  try {
    await vscode.workspace.fs.createDirectory(store.dir);

    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(store.dir, STORAGE_FILE)
    );
    const reload = async () => {
      if (await store.reloadIfChanged()) provider.refresh(undefined);
    };

    context.subscriptions.push(
      watcher,
      watcher.onDidChange(reload),
      watcher.onDidCreate(reload),
      watcher.onDidDelete(reload)
    );
  } catch (err) {
    // Not fatal — marks still work, they just will not sync live between windows.
  }
}

/** @param {vscode.ExtensionContext} context */
async function activate(context) {
  const store = new MarkStore(context);
  context.subscriptions.push(store);

  await store.load();
  await store.migrateLegacyStorage();

  const provider = new MarkDecorationProvider(store);
  context.subscriptions.push(provider);

  const lines = new LineDecorations(store);
  context.subscriptions.push(lines);

  context.subscriptions.push(
    store.onChanged((uris) => {
      provider.refresh(uris);
      lines.refresh(uris);
    })
  );

  const priority = new DecorationPriority(provider, () =>
    vscode.workspace.getConfiguration('fileMarks').get('priorityOverGit', true)
  );
  context.subscriptions.push(priority);
  priority.reassert(GIT_SETTLE_DELAY);
  void priority.watchGit();

  void watchStorage(context, store, provider);

  // Marked lines are drawn per editor, so a newly opened or moved one needs
  // painting, and every edit can move the marks of the file being typed in.
  lines.refresh(undefined);
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => lines.refresh(undefined)),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) return;
      if (!store.shiftLines(event.document.uri, event.contentChanges)) return;
      lines.refresh(event.document.uri);
      store.saveSoon();
    })
  );

  // Renames, moves and deletes made inside VS Code take their marks with them,
  // folders included — and a create puts them back when the delete is undone.
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (event) => {
      let touched = false;
      for (const { oldUri, newUri } of event.files) {
        touched = store.renameInMemory(oldUri, newUri) || touched;
      }
      await store.commit(touched);
    }),
    vscode.workspace.onDidDeleteFiles(async (event) => {
      await store.commit(store.deleteInMemory(event.files));
    }),
    vscode.workspace.onDidCreateFiles(async (event) => {
      await store.commit(store.restoreDeleted(event.files));
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('fileMarks')) return;
      provider.reloadOptions();
      provider.refresh(undefined);
      lines.reloadOptions();
      lines.refresh(undefined);
    })
  );

  registerCommands(context, store, priority);
}

function deactivate() {}

module.exports = { activate, deactivate };
