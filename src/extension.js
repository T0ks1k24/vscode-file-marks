'use strict';

const vscode = require('vscode');

const { MarkStore } = require('./markStore');
const { MarkDecorationProvider } = require('./decorationProvider');
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
  context.subscriptions.push(store.onChanged((uris) => provider.refresh(uris)));

  const priority = new DecorationPriority(provider, () =>
    vscode.workspace.getConfiguration('fileMarks').get('priorityOverGit', true)
  );
  context.subscriptions.push(priority);
  priority.reassert(GIT_SETTLE_DELAY);
  void priority.watchGit();

  void watchStorage(context, store, provider);

  // Renames and moves made inside VS Code carry their marks along, folders included.
  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles(async (event) => {
      let touched = false;
      for (const { oldUri, newUri } of event.files) {
        touched = store.renameInMemory(oldUri, newUri) || touched;
      }
      await store.commitRenames(touched);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('fileMarks')) return;
      provider.reloadOptions();
      provider.refresh(undefined);
    })
  );

  registerCommands(context, store, priority);
}

function deactivate() {}

module.exports = { activate, deactivate };
