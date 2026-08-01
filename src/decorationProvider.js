'use strict';

const vscode = require('vscode');

/** Reads the settings once per change instead of once per rendered row. */
function readOptions() {
  const cfg = vscode.workspace.getConfiguration('fileMarks');
  return {
    showTagInTooltip: cfg.get('showTagInTooltip', true),
    propagate: cfg.get('propagateToParents', false),
  };
}

/**
 * Paints the Explorer rows. `provideFileDecoration` runs for every visible
 * item on every refresh, so it does no configuration lookups and no parsing —
 * tags are sanitised once in the store, theme colours are memoised here.
 *
 * @implements {vscode.FileDecorationProvider}
 */
class MarkDecorationProvider {
  /** @param {import('./markStore').MarkStore} store */
  constructor(store) {
    this.store = store;
    this._emitter = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this._emitter.event;
    this._options = readOptions();
    /** @type {Map<string, vscode.ThemeColor>} */
    this._colors = new Map();
  }

  dispose() {
    this._emitter.dispose();
  }

  /** @param {vscode.Uri | readonly vscode.Uri[]} [uris] undefined redraws everything */
  refresh(uris) {
    this._emitter.fire(uris);
  }

  reloadOptions() {
    this._options = readOptions();
  }

  /** @param {string} id */
  _themeColor(id) {
    let color = this._colors.get(id);
    if (!color) {
      color = new vscode.ThemeColor(id);
      this._colors.set(id, color);
    }
    return color;
  }

  /** @param {vscode.Uri} uri */
  provideFileDecoration(uri) {
    const mark = this.store.get(uri);
    if (!mark) return undefined;

    const { showTagInTooltip, propagate } = this._options;

    let tooltip;
    if (mark.tag && showTagInTooltip && mark.description) tooltip = `${mark.tag} — ${mark.description}`;
    else if (mark.description) tooltip = mark.description;
    else if (mark.tag && showTagInTooltip) tooltip = mark.tag;

    const decoration = new vscode.FileDecoration(
      mark.tag,
      tooltip,
      mark.color ? this._themeColor(mark.color) : undefined
    );
    decoration.propagate = propagate;
    return decoration;
  }
}

module.exports = { MarkDecorationProvider };
