'use strict';

const vscode = require('vscode');

/**
 * Storage keys are absolute paths for local files and uri strings for anything
 * else (untitled, remote, virtual file systems). A Windows drive letter is a
 * single character, so requiring two before the colon keeps `C:\...` a path.
 */
const URI_KEY = /^[a-z][a-z0-9+.-]+:/i;

/** @param {string} key */
function isPathKey(key) {
  return !URI_KEY.test(key);
}

/** @param {string} key */
function keyToUri(key) {
  if (isPathKey(key)) return vscode.Uri.file(key);
  try {
    return vscode.Uri.parse(key, true);
  } catch (err) {
    return vscode.Uri.file(key);
  }
}

module.exports = { keyToUri };
