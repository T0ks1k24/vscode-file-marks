'use strict';

const { MAX_KEY_LENGTH } = require('./constants');

/**
 * Keys for workspace storage, as string arithmetic over `Uri.path` — which is
 * always `/`-separated, on every platform and for every scheme. Nothing here
 * touches `vscode` or the local file system, so the encoding is the same in a
 * remote, WSL, container or virtual workspace as it is on local disk, and can
 * be tested on its own.
 */

/** The workspace folder itself. `.` cannot be a real file name, so it is free. */
const ROOT_KEY = '.';

/** @param {string} path */
function withoutTrailingSlash(path) {
  return path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') : path;
}

/**
 * A key we are willing to resolve. The storage file is shared and hand
 * editable, so a key must not be able to point at anything outside the
 * workspace: no absolute path, no drive letter, no empty, `.` or `..` segment.
 *
 * Backslashes are refused as well. They are ordinary characters in a posix file
 * name, but `Uri.joinPath` hands a `file:` uri to the win32 joiner on Windows,
 * where `a\..\..\b` climbs out of the workspace inside what looks like a single
 * segment. A file named with a backslash is rare; being unable to escape the
 * workspace is not negotiable.
 *
 * @param {unknown} key
 */
function isSafeKey(key) {
  if (typeof key !== 'string' || !key || key.length > MAX_KEY_LENGTH) return false;
  if (key === ROOT_KEY) return true;
  if (key.startsWith('/') || key.includes('\\') || /^[A-Za-z]:/.test(key)) return false;
  return key.split('/').every((segment) => segment && segment !== '.' && segment !== '..');
}

/**
 * The key for a resource inside the workspace folder, or undefined when it is
 * somewhere else. Both arguments are `Uri.path` values.
 *
 * @param {string} rootPath
 * @param {string} targetPath
 * @returns {string | undefined}
 */
function relativeKey(rootPath, targetPath) {
  const root = withoutTrailingSlash(rootPath);
  const target = withoutTrailingSlash(targetPath);
  if (target === root) return ROOT_KEY;

  // `/project` must not swallow `/project-old`, hence the separator.
  const prefix = root === '/' ? '/' : `${root}/`;
  if (!target.startsWith(prefix)) return undefined;

  const key = target.slice(prefix.length);
  return isSafeKey(key) ? key : undefined;
}

module.exports = { ROOT_KEY, isSafeKey, relativeKey };
