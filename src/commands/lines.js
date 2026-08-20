'use strict';

const vscode = require('vscode');

const { COLORS } = require('../constants');

/** A fresh instance each time — QuickPick keeps item identity. */
const separator = () => ({ label: '', kind: vscode.QuickPickItemKind.Separator });

/**
 * The lines a gutter command should work on.
 *
 * VS Code hands us `{ lineNumber, uri }` and has already sorted out the
 * selection: right-clicking a line number inside a selection keeps it, and
 * right-clicking outside one selects that single line. So the selection is the
 * answer whenever it belongs to the document that was clicked; the line number
 * is there for the Command Palette, where there is no click at all.
 *
 * @param {unknown} arg
 * @returns {{ uri: vscode.Uri, lines: number[] } | undefined}
 */
function targetLines(arg) {
  const editor = vscode.window.activeTextEditor;
  const options = arg && typeof arg === 'object' ? /** @type {any} */ (arg) : {};
  const uri = options.uri instanceof vscode.Uri ? options.uri : editor && editor.document.uri;
  if (!uri) return undefined;

  /** @type {Set<number>} */
  const lines = new Set();
  if (editor && editor.document.uri.toString() === uri.toString()) {
    for (const selection of editor.selections) {
      // A selection dragged down to the start of the next line does not reach
      // into it, so that line is not marked.
      const last =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;
      for (let line = selection.start.line; line <= last; line++) lines.add(line + 1);
    }
  }
  if (lines.size === 0 && Number.isInteger(options.lineNumber)) lines.add(options.lineNumber);
  if (lines.size === 0) return undefined;

  return { uri, lines: [...lines].sort((a, b) => a - b) };
}

/** @param {readonly number[]} lines */
function describeLines(lines) {
  return lines.length === 1 ? `line ${lines[0]}` : `${lines.length} lines`;
}

/**
 * @param {(id: string, handler: (...args: any[]) => any) => void} register
 * @param {import('../markStore').MarkStore} store
 */
function registerLineCommands(register, store) {
  const resolve = (arg) => {
    const target = targetLines(arg);
    if (!target) vscode.window.showWarningMessage('File Marks: no line selected.');
    return target;
  };

  // --- colour the selected lines -------------------------------------------
  register('fileMarks.setLineColor', async (arg) => {
    const target = resolve(arg);
    if (!target) return;

    const marked = store.getLines(target.uri) || {};
    const current = target.lines.length === 1 ? (marked[String(target.lines[0])] || {}).color : undefined;

    const items = COLORS.map((c) => ({
      label: c.label,
      description: c.id === current ? `${c.id}  (current)` : c.id,
      colorId: c.id,
    }));
    items.push(separator(), { label: '$(circle-slash) No colour', colorId: null });

    const picked = await vscode.window.showQuickPick(items, {
      title: `Line colour → ${describeLines(target.lines)}`,
      placeHolder: 'Pick the colour of the stripe beside the line numbers',
      matchOnDescription: true,
    });
    if (!picked) return;

    await store.setLines(target.uri, target.lines, picked.colorId);
  });

  // --- take the mark off the selected lines --------------------------------
  register('fileMarks.clearLines', async (arg) => {
    const target = resolve(arg);
    if (!target) return;
    await store.setLines(target.uri, target.lines, null);
  });

  // --- take every mark out of this file ------------------------------------
  register('fileMarks.clearFileLines', async (arg) => {
    const options = arg && typeof arg === 'object' ? /** @type {any} */ (arg) : {};
    const editor = vscode.window.activeTextEditor;
    const uri = options.uri instanceof vscode.Uri ? options.uri : editor && editor.document.uri;
    if (!uri) {
      vscode.window.showWarningMessage('File Marks: no file open.');
      return;
    }

    const marked = store.getLines(uri);
    if (!marked) {
      vscode.window.showInformationMessage('File Marks: no marked lines in this file.');
      return;
    }
    await store.setLines(uri, Object.keys(marked).map(Number), null);
  });
}

module.exports = { registerLineCommands };
