'use strict';

const vscode = require('vscode');
const path = require('path');

const { keyToUri } = require('./keys');
const { ROOT_KEY, isSafeKey, relativeKey } = require('./workspaceKeys');
const {
  MODE_GLOBAL,
  MODE_WORKSPACE,
  STORAGE_FILE,
  WORKSPACE_STORAGE_DIR,
  WORKSPACE_STORAGE_FILE,
} = require('./constants');

/**
 * Where marks are kept, and how a resource becomes a key there.
 *
 * Global storage is the default and is unchanged: one file in the extension's
 * own folder, keyed by absolute path. Workspace storage puts the same document
 * inside the workspace, keyed relative to it, so everyone who opens that folder
 * sees the same marks.
 *
 * @typedef {object} Codec
 * @property {(uri: vscode.Uri) => string | undefined} key     undefined when the resource cannot be stored
 * @property {(key: string) => vscode.Uri | undefined} uri     undefined when the key cannot be resolved
 * @property {(key: string) => boolean} accepts                may this key be loaded from the file at all
 * @property {(uri: vscode.Uri) => string} childSeparator      what separates a key from the keys beneath it
 *
 * @typedef {object} Target
 * @property {string} mode
 * @property {vscode.Uri} dir
 * @property {vscode.Uri} file
 * @property {vscode.Uri | vscode.WorkspaceFolder} watchBase
 * @property {string} watchPattern
 * @property {boolean} createDir
 * @property {Codec} codec
 */

function readMode() {
  const mode = vscode.workspace.getConfiguration('fileMarks').get('storage', MODE_GLOBAL);
  return mode === MODE_WORKSPACE ? MODE_WORKSPACE : MODE_GLOBAL;
}

/**
 * The one folder workspace keys can be relative to. A multi-root workspace has
 * no such folder — every scheme for naming several roots portably is ambiguous
 * about whether the first segment of a key is a root or a directory — so it
 * keeps using global storage.
 */
function soleWorkspaceFolder() {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length === 1 ? folders[0] : undefined;
}

/** @returns {Codec} */
function createGlobalCodec() {
  return {
    key: (uri) => (uri.scheme === 'file' ? uri.fsPath : uri.toString()),
    uri: (key) => keyToUri(key),
    accepts: () => true,
    // Local keys are file system paths, everything else is a uri string.
    childSeparator: (uri) => (uri.scheme === 'file' ? path.sep : '/'),
  };
}

/**
 * @param {vscode.Uri} root the workspace folder marks are stored relative to
 * @returns {Codec}
 */
function createWorkspaceCodec(root) {
  return {
    key(uri) {
      // A resource of another scheme or authority — an untitled editor, a file
      // on local disk while the workspace is remote — has no portable name
      // inside this workspace, and storing its absolute one would put a local
      // path into a file other people read.
      if (uri.scheme !== root.scheme || uri.authority !== root.authority) return undefined;
      return relativeKey(root.path, uri.path);
    },

    uri(key) {
      if (!isSafeKey(key)) return undefined;
      if (key === ROOT_KEY) return root;

      const joined = vscode.Uri.joinPath(root, key);
      // `joinPath` normalises, and on Windows it joins `file:` uris with the
      // win32 rules. Checking the result rather than trusting the input is what
      // makes a hand-edited storage file unable to reach outside the workspace.
      return relativeKey(root.path, joined.path) === undefined ? undefined : joined;
    },

    accepts: (key) => isSafeKey(key),
    childSeparator: () => '/',
  };
}

/**
 * Resolves the active storage once, at activation. The mode is not changed
 * underneath a running store — see the reload prompt in `extension.js`.
 *
 * @param {vscode.ExtensionContext} context
 * @returns {Target}
 */
function resolveTarget(context) {
  if (readMode() === MODE_WORKSPACE) {
    const folder = soleWorkspaceFolder();
    if (folder) {
      const dir = vscode.Uri.joinPath(folder.uri, WORKSPACE_STORAGE_DIR);
      return {
        mode: MODE_WORKSPACE,
        dir,
        file: vscode.Uri.joinPath(dir, WORKSPACE_STORAGE_FILE),
        // Based on the folder, not on `.vscode`, so the watcher also sees the
        // file being created — and so nothing has to be created to watch it.
        watchBase: folder,
        watchPattern: `${WORKSPACE_STORAGE_DIR}/${WORKSPACE_STORAGE_FILE}`,
        createDir: false,
        codec: createWorkspaceCodec(folder.uri),
      };
    }
  }

  const dir = context.globalStorageUri;
  return {
    mode: MODE_GLOBAL,
    dir,
    file: vscode.Uri.joinPath(dir, STORAGE_FILE),
    watchBase: dir,
    watchPattern: STORAGE_FILE,
    createDir: true,
    codec: createGlobalCodec(),
  };
}

module.exports = { readMode, resolveTarget, createGlobalCodec, createWorkspaceCodec };
