'use strict';

const vscode = require('vscode');

const { registerMarkCommands } = require('./marks');
const { registerListCommand } = require('./list');
const { registerMaintenanceCommands } = require('./maintenance');

/**
 * @param {vscode.ExtensionContext} context
 * @param {import('../markStore').MarkStore} store
 * @param {import('../decorationPriority').DecorationPriority} priority
 */
function registerCommands(context, store, priority) {
  /** Every handler is wrapped so a thrown error surfaces once instead of as an unhandled rejection. */
  const register = (id, handler) => {
    const safe = async (...args) => {
      try {
        return await handler(...args);
      } catch (err) {
        vscode.window.showErrorMessage(`File Marks: ${err && err.message ? err.message : String(err)}`);
        return undefined;
      }
    };
    context.subscriptions.push(vscode.commands.registerCommand(id, safe));
  };

  registerMarkCommands(register, store);
  registerListCommand(register, store);
  registerMaintenanceCommands(register, store);

  register('fileMarks.bringToFront', () => {
    priority.reassert(0, true);
    vscode.window.showInformationMessage('File Marks: marks take priority over git colours again.');
  });
}

module.exports = { registerCommands };
