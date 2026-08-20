'use strict';

const vscode = require('vscode');

/** Widths outside this are either invisible or cover the code. */
const MIN_WIDTH = 1;
const MAX_WIDTH = 12;
const DEFAULT_WIDTH = 3;

function readWidth() {
  const raw = Number(vscode.workspace.getConfiguration('fileMarks').get('lineMarkWidth', DEFAULT_WIDTH));
  if (!Number.isFinite(raw)) return DEFAULT_WIDTH;
  return Math.min(Math.max(Math.round(raw), MIN_WIDTH), MAX_WIDTH);
}

/**
 * Draws the marked lines: a stripe in the colour of the mark where the line
 * numbers end, and a tick in the overview ruler so a mark far off screen can
 * still be found.
 *
 * One decoration type per colour, made on demand and then kept — VS Code turns
 * each one into a stylesheet rule, which is not something to do per redraw.
 */
class LineDecorations {
  /** @param {import('./markStore').MarkStore} store */
  constructor(store) {
    this.store = store;
    /** @type {Map<string, vscode.TextEditorDecorationType>} */
    this._types = new Map();
    this._width = readWidth();
  }

  dispose() {
    this._disposeTypes();
  }

  _disposeTypes() {
    for (const type of this._types.values()) type.dispose();
    this._types.clear();
  }

  /** A different width is a different stylesheet rule, so the types are rebuilt. */
  reloadOptions() {
    const width = readWidth();
    if (width === this._width) return;
    this._width = width;
    this._disposeTypes();
  }

  /** @param {string} colorId */
  _type(colorId) {
    let type = this._types.get(colorId);
    if (!type) {
      const color = new vscode.ThemeColor(colorId);
      type = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderStyle: 'solid',
        borderWidth: `0 0 0 ${this._width}px`,
        borderColor: color,
        overviewRulerColor: color,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
      });
      this._types.set(colorId, type);
    }
    return type;
  }

  /** @param {vscode.TextEditor} editor */
  _paint(editor) {
    const lines = this.store.getLines(editor.document.uri);

    /** @type {Map<string, vscode.Range[]>} */
    const byColor = new Map();
    if (lines) {
      const lineCount = editor.document.lineCount;
      for (const [at, mark] of Object.entries(lines)) {
        const line = Number(at);
        // The file may have been cut short outside the editor.
        if (line > lineCount) continue;

        const range = new vscode.Range(line - 1, 0, line - 1, 0);
        const ranges = byColor.get(mark.color);
        if (ranges) ranges.push(range);
        else byColor.set(mark.color, [range]);
      }
    }

    for (const [colorId, ranges] of byColor) editor.setDecorations(this._type(colorId), ranges);

    // A colour that lost its last line in this editor has to be told so, or its
    // stripes stay on screen.
    for (const [colorId, type] of this._types) {
      if (!byColor.has(colorId)) editor.setDecorations(type, []);
    }
  }

  /** @param {vscode.Uri | readonly vscode.Uri[]} [uris] undefined repaints every editor */
  refresh(uris) {
    let wanted;
    if (uris !== undefined) {
      const list = Array.isArray(uris) ? uris : [uris];
      wanted = new Set(list.map((uri) => this.store.key(uri)));
    }

    for (const editor of vscode.window.visibleTextEditors) {
      if (wanted && !wanted.has(this.store.key(editor.document.uri))) continue;
      this._paint(editor);
    }
  }
}

module.exports = { LineDecorations };
