'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { ROOT_KEY, isSafeKey, relativeKey } = require('../src/workspaceKeys');

/**
 * The codec is pure string arithmetic over `Uri.path`, so it is tested as such.
 * Everything around it — the real `Uri`, the file system, the watcher — is left
 * to the F5 workflow: a stub of those would only prove the stub agrees with
 * itself, and it is exactly their platform-specific behaviour that matters.
 */

const ROOT = '/home/dev/project';

test('the workspace folder itself is the root key', () => {
  assert.strictEqual(relativeKey(ROOT, ROOT), ROOT_KEY);
  assert.strictEqual(relativeKey(ROOT, `${ROOT}/`), ROOT_KEY);
  assert.strictEqual(relativeKey(`${ROOT}/`, ROOT), ROOT_KEY);
});

test('a resource inside the folder keys relative to it', () => {
  assert.strictEqual(relativeKey(ROOT, `${ROOT}/src`), 'src');
  assert.strictEqual(relativeKey(ROOT, `${ROOT}/src/commands/list.js`), 'src/commands/list.js');
  assert.strictEqual(relativeKey(ROOT, `${ROOT}/Working Papers/Cash 2024.xlsx`), 'Working Papers/Cash 2024.xlsx');
});

test('a trailing slash on the folder changes nothing', () => {
  assert.strictEqual(relativeKey(`${ROOT}/`, `${ROOT}/src/a.js`), 'src/a.js');
});

test('a filesystem root as the workspace folder still works', () => {
  assert.strictEqual(relativeKey('/', '/etc/hosts'), 'etc/hosts');
  assert.strictEqual(relativeKey('/', '/'), ROOT_KEY);
});

test('a sibling whose name starts with the folder name is outside it', () => {
  assert.strictEqual(relativeKey(ROOT, '/home/dev/project-old/src/a.js'), undefined);
  assert.strictEqual(relativeKey(ROOT, '/home/dev/projectile'), undefined);
});

test('anything above or beside the folder is outside it', () => {
  assert.strictEqual(relativeKey(ROOT, '/home/dev'), undefined);
  assert.strictEqual(relativeKey(ROOT, '/etc/passwd'), undefined);
  assert.strictEqual(relativeKey(ROOT, '/Untitled-1'), undefined);
});

test('a windows path keys the same way, because Uri.path is posix', () => {
  // `Uri.file('C:\\code\\app\\src\\a.ts').path` is `/c:/code/app/src/a.ts`.
  assert.strictEqual(relativeKey('/c:/code/app', '/c:/code/app/src/a.ts'), 'src/a.ts');
  assert.strictEqual(relativeKey('/c:/code/app', '/d:/code/app/src/a.ts'), undefined);
});

test('a key round trips through the path it was made from', () => {
  for (const key of ['a.js', 'src/a.js', 'a/b/c/d.txt', 'dir with spaces/x.md', '.gitignore', 'a..b/c']) {
    assert.strictEqual(relativeKey(ROOT, `${ROOT}/${key}`), key, key);
    assert.strictEqual(isSafeKey(key), true, key);
  }
});

test('the root key is safe and nothing else built from dots is', () => {
  assert.strictEqual(isSafeKey(ROOT_KEY), true);
  for (const key of ['..', '../', '../outside', 'a/../../b', 'a/..', './a', 'a/./b', 'a/', '/a', '']) {
    assert.strictEqual(isSafeKey(key), false, key);
  }
});

test('a key cannot be an absolute path or a drive letter', () => {
  for (const key of ['/etc/passwd', 'C:/Windows', 'c:relative', '//server/share']) {
    assert.strictEqual(isSafeKey(key), false, key);
  }
});

test('a key cannot contain a backslash, which joins as a separator on windows', () => {
  for (const key of ['a\\b', 'a\\..\\..\\b', '..\\b']) {
    assert.strictEqual(isSafeKey(key), false, key);
  }
});

test('a key must be a plausible string', () => {
  for (const key of [undefined, null, 42, {}, [], 'a'.repeat(4097)]) {
    assert.strictEqual(isSafeKey(key), false, String(key));
  }
  assert.strictEqual(isSafeKey('a'.repeat(4096)), true);
});

test('a path that would make an unsafe key is refused rather than encoded', () => {
  // Nothing normal produces these, but the file system is not ours to trust.
  assert.strictEqual(relativeKey(ROOT, `${ROOT}//double`), undefined);
  assert.strictEqual(relativeKey(ROOT, `${ROOT}/back\\slash`), undefined);
});
