'use strict';

const vscode = require('vscode');
const path = require('path');

const { sanitizeTag, sanitizeDescription } = require('./badge');
const { STORAGE_FILE, LEGACY_STORAGE_DIRS } = require('./constants');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Colour ids we hand to the theme; anything else in the file is dropped. */
const COLOR_ID = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;

/** Keys that would walk the prototype chain instead of being stored as data. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** No real path or uri is this long — anything longer is junk in the file. */
const MAX_KEY_LENGTH = 4096;

/**
 * @typedef {object} Mark
 * @property {string} [color]       theme colour id
 * @property {string} [tag]         one or two characters, drawn next to the name
 * @property {string} [description] hover text
 */

/**
 * Turns whatever is in the JSON file into a mark we can trust — the file is
 * user editable and can also arrive through Import, so nothing in it is taken
 * at face value. Sanitising happens here, once, and never on the hot path
 * where the Explorer asks for a decoration.
 *
 * @param {unknown} raw
 * @returns {Mark | undefined}
 */
function normalizeMark(raw) {
  if (!raw || typeof raw !== 'object') return undefined;

  /** @type {Mark} */
  const mark = {};
  if (typeof raw.color === 'string' && COLOR_ID.test(raw.color)) mark.color = raw.color;

  const tag = sanitizeTag(raw.tag);
  if (tag) mark.tag = tag;

  const description = sanitizeDescription(raw.description);
  if (description) mark.description = description;

  return Object.keys(mark).length > 0 ? mark : undefined;
}

/** The three fields that go to disk, in a fixed order and nothing else. */
function serializeMark(mark) {
  const out = {};
  if (mark.color) out.color = mark.color;
  if (mark.tag) out.tag = mark.tag;
  if (mark.description) out.description = mark.description;
  return out;
}

/**
 * Marks live in one JSON file inside the extension's global storage, so they
 * follow the user across every workspace. Nothing else on disk is touched.
 */
class MarkStore {
  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.dir = context.globalStorageUri;
    this.file = vscode.Uri.joinPath(this.dir, STORAGE_FILE);

    /** @type {Map<string, Mark>} */
    this.marks = new Map();

    this._emitter = new vscode.EventEmitter();
    /** Fires with the affected uris, or undefined when everything changed. */
    this.onChanged = this._emitter.event;

    /** Serialised form of the last write, so the watcher can ignore our own I/O. */
    this._lastWritten = '';
    /** Writes are chained — concurrent commands can never interleave. */
    this._writes = Promise.resolve();
  }

  dispose() {
    this._emitter.dispose();
  }

  /** @param {vscode.Uri} uri */
  key(uri) {
    return uri.scheme === 'file' ? uri.fsPath : uri.toString();
  }

  /** @param {vscode.Uri} uri */
  get(uri) {
    return this.marks.get(this.key(uri));
  }

  entries() {
    return [...this.marks.entries()];
  }

  get size() {
    return this.marks.size;
  }

  /**
   * A null-prototype object: a mark could otherwise be keyed `__proto__` and
   * silently set the prototype instead of becoming a property.
   */
  toPlainObject() {
    /** @type {Record<string, object>} */
    const out = Object.create(null);
    for (const [key, mark] of this.marks) out[key] = serializeMark(mark);
    return out;
  }

  /** @param {unknown} plain */
  _adopt(plain) {
    const next = new Map();
    if (plain && typeof plain === 'object' && !Array.isArray(plain)) {
      for (const [key, raw] of Object.entries(plain)) {
        if (!key || key.length > MAX_KEY_LENGTH || FORBIDDEN_KEYS.has(key)) continue;
        const mark = normalizeMark(raw);
        if (mark) next.set(key, mark);
      }
    }
    this.marks = next;
  }

  async _readText() {
    const bytes = await vscode.workspace.fs.readFile(this.file);
    return decoder.decode(bytes);
  }

  /** Reads the storage file. A missing or broken file simply means "no marks". */
  async load() {
    try {
      const text = await this._readText();
      this._lastWritten = text;
      this._adopt(JSON.parse(text));
    } catch (err) {
      this._adopt(undefined);
    }
  }

  /**
   * Watcher callback. Returns true when the file really changed underneath us
   * (another VS Code window), false for our own writes.
   */
  async reloadIfChanged() {
    let text;
    try {
      text = await this._readText();
    } catch (err) {
      return false;
    }
    if (text === this._lastWritten) return false;

    this._lastWritten = text;
    try {
      this._adopt(JSON.parse(text));
    } catch (err) {
      return false;
    }
    return true;
  }

  /**
   * Picks up marks written by an older build that used a different publisher
   * id (the global storage folder is named `<publisher>.<name>`).
   * Runs only when we have nothing of our own.
   */
  async migrateLegacyStorage() {
    if (this.marks.size > 0) return 0;

    for (const folder of LEGACY_STORAGE_DIRS) {
      const legacy = vscode.Uri.joinPath(this.dir, '..', folder, STORAGE_FILE);
      if (legacy.fsPath === this.file.fsPath) continue;
      try {
        const bytes = await vscode.workspace.fs.readFile(legacy);
        const parsed = JSON.parse(decoder.decode(bytes));
        this._adopt(parsed);
        if (this.marks.size === 0) continue;
        await this.save();
        return this.marks.size;
      } catch (err) {
        // no such folder / unreadable — nothing to migrate
      }
    }
    return 0;
  }

  save() {
    this._writes = this._writes.then(
      () => this._write(),
      () => this._write()
    );
    return this._writes;
  }

  async _write() {
    const text = JSON.stringify(this.toPlainObject(), null, 2);
    try {
      await vscode.workspace.fs.createDirectory(this.dir);
      await vscode.workspace.fs.writeFile(this.file, encoder.encode(text));
      this._lastWritten = text;
    } catch (err) {
      vscode.window.showErrorMessage(`File Marks: could not save marks — ${err.message}`);
    }
  }

  /**
   * @param {readonly vscode.Uri[]} uris
   * @param {{ color?: string | null, tag?: string | null, description?: string | null }} patch
   *        `null` (or an empty string) removes the field.
   */
  async update(uris, patch) {
    for (const uri of uris) {
      const key = this.key(uri);
      const raw = Object.assign({}, serializeMark(this.marks.get(key) || {}));

      for (const [field, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') delete raw[field];
        else raw[field] = value;
      }

      const mark = normalizeMark(raw);
      if (mark) this.marks.set(key, mark);
      else this.marks.delete(key);
    }
    await this.save();
    this._emitter.fire(uris);
  }

  /** @param {readonly vscode.Uri[]} uris */
  async remove(uris) {
    let touched = false;
    for (const uri of uris) touched = this.marks.delete(this.key(uri)) || touched;
    if (!touched) return;
    await this.save();
    this._emitter.fire(uris);
  }

  /** @param {readonly string[]} keys */
  async removeKeys(keys) {
    let touched = false;
    for (const key of keys) touched = this.marks.delete(key) || touched;
    if (!touched) return;
    await this.save();
    this._emitter.fire(undefined);
  }

  /** @param {unknown} plain */
  async replaceAll(plain) {
    this._adopt(plain);
    await this.save();
    this._emitter.fire(undefined);
  }

  /**
   * Follows a rename or move, including every mark inside a renamed folder.
   * @param {vscode.Uri} oldUri
   * @param {vscode.Uri} newUri
   */
  renameInMemory(oldUri, newUri) {
    const from = this.key(oldUri);
    const to = this.key(newUri);
    if (from === to) return false;

    // Local keys are file system paths, everything else is a uri string.
    const prefix = from + (oldUri.scheme === 'file' ? path.sep : '/');
    let touched = false;

    for (const [key, mark] of [...this.marks]) {
      if (key === from) {
        this.marks.delete(key);
        this.marks.set(to, mark);
        touched = true;
      } else if (key.startsWith(prefix)) {
        this.marks.delete(key);
        this.marks.set(to + key.slice(from.length), mark);
        touched = true;
      }
    }
    return touched;
  }

  async commitRenames(touched) {
    if (!touched) return;
    await this.save();
    this._emitter.fire(undefined);
  }
}

module.exports = { MarkStore };
