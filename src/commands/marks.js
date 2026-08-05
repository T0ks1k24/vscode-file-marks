'use strict';

const vscode = require('vscode');

const { COLORS, BADGE_SUGGESTIONS } = require('../constants');
const { sanitizeTag } = require('../badge');
const { presetPatch, buildPatch, alreadyApplied, clearingPatch } = require('../markArgs');
const { describeTargets, withTargets } = require('../targets');

/** A fresh instance each time — QuickPick keeps item identity, so never share one. */
const separator = () => ({ label: '', kind: vscode.QuickPickItemKind.Separator });

/** Ideographic space — keeps presets without a badge aligned. */
const PAD = '　';

function getPresets() {
  const raw = vscode.workspace.getConfiguration('fileMarks').get('presets', []);
  return Array.isArray(raw) ? raw.filter((p) => p && typeof p.label === 'string' && p.label) : [];
}

function getBadgeSuggestions() {
  const raw = vscode.workspace.getConfiguration('fileMarks').get('badgeSuggestions', []);
  const custom = Array.isArray(raw) ? raw.map(sanitizeTag).filter(Boolean) : [];
  return custom.length > 0 ? custom : BADGE_SUGGESTIONS;
}

/**
 * @param {(id: string, handler: (...args: any[]) => any) => void} register
 * @param {import('../markStore').MarkStore} store
 */
function registerMarkCommands(register, store) {
  // --- quick preset --------------------------------------------------------
  register('fileMarks.applyPreset', (uri, uris) =>
    withTargets(uri, uris, async (targets) => {
      const presets = getPresets();
      const items = presets.map((p) => ({
        label: `${p.badge || PAD}  ${p.label}`,
        description: p.description || '',
        detail: p.color ? `colour: ${String(p.color).replace('fileMarks.', '')}` : undefined,
        preset: p,
      }));

      items.push(
        separator(),
        { label: '$(paintcan) Colour only…', action: 'fileMarks.setColor' },
        { label: '$(tag) Tag only…', action: 'fileMarks.setTag' },
        { label: '$(comment) Description only…', action: 'fileMarks.setDescription' },
        { label: '$(circle-slash) Remove mark', action: 'fileMarks.clear' }
      );

      const picked = await vscode.window.showQuickPick(items, {
        title: `Mark → ${describeTargets(targets)}`,
        placeHolder: 'Pick a preset',
      });
      if (!picked) return;

      if (picked.action) {
        // The resolved targets are passed on, not the original arguments: with
        // the picker open the Explorer no longer has focus, so asking for its
        // selection a second time would answer with the active editor instead.
        await vscode.commands.executeCommand(picked.action, targets[0], targets);
        return;
      }

      await store.update(targets, presetPatch(picked.preset));
    })
  );

  // --- one command for every keybinding ------------------------------------
  // Bound to a key, `args` arrives here as the first argument; from a menu that
  // slot holds the uri instead, and then there is nothing to apply but the
  // picker. Everything a mark is made of can be set, cleared or combined, so a
  // keybinding never needs more than this one command.
  register('fileMarks.apply', (uri, uris) => {
    const options = !(uri instanceof vscode.Uri) && uri && typeof uri === 'object' ? uri : {};

    const { patch, error } = buildPatch(options, getPresets());
    if (error) {
      vscode.window.showWarningMessage(`File Marks: ${error}.`);
      return undefined;
    }
    if (!patch) return vscode.commands.executeCommand('fileMarks.applyPreset', uri, uris);

    return withTargets(uri, uris, async (targets) => {
      // Pressing the same key again takes the mark back off, unless the binding
      // says otherwise.
      const undo = options.toggle !== false && alreadyApplied(store, targets, patch);
      await store.update(targets, undo ? clearingPatch(patch) : patch);
    });
  });

  // --- colour --------------------------------------------------------------
  register('fileMarks.setColor', (uri, uris) =>
    withTargets(uri, uris, async (targets) => {
      const current = targets.length === 1 ? (store.get(targets[0]) || {}).color : undefined;

      const items = COLORS.map((c) => ({
        label: c.label,
        description: c.id === current ? `${c.id}  (current)` : c.id,
        colorId: c.id,
      }));
      items.push(separator(), { label: '$(circle-slash) No colour', colorId: null });

      const picked = await vscode.window.showQuickPick(items, {
        title: `Colour → ${describeTargets(targets)}`,
        placeHolder: 'Pick the colour of the name in the Explorer',
        matchOnDescription: true,
      });
      if (!picked) return;
      await store.update(targets, { color: picked.colorId });
    })
  );

  // --- tag / badge ---------------------------------------------------------
  register('fileMarks.setTag', (uri, uris) =>
    withTargets(uri, uris, async (targets) => {
      const current = targets.length === 1 ? (store.get(targets[0]) || {}).tag : undefined;

      const suggestions = () => [
        { label: '$(circle-slash) No tag', badge: null },
        separator(),
        ...getBadgeSuggestions().map((b) => ({ label: b, badge: b })),
      ];

      const quick = vscode.window.createQuickPick();
      quick.title = `Tag → ${describeTargets(targets)}`;
      quick.placeholder = 'Pick one, or type your own (1-2 characters) and press Enter';
      quick.items = suggestions();
      quick.value = current || '';

      const value = await new Promise((resolve) => {
        quick.onDidChangeValue((typed) => {
          const custom = typed.trim();
          if (!custom) {
            quick.items = suggestions();
            return;
          }
          const clean = sanitizeTag(custom);
          quick.items = [
            clean
              ? {
                  label: clean,
                  description: clean === custom ? 'custom tag' : 'custom tag — cut to 2 characters',
                  badge: clean,
                }
              : { label: `$(error) "${custom}" cannot be used as a tag`, badge: undefined },
            separator(),
            ...suggestions(),
          ];
        });
        quick.onDidAccept(() => {
          const selected = quick.selectedItems[0];
          resolve(selected ? selected.badge : undefined);
          quick.hide();
        });
        quick.onDidHide(() => {
          resolve(undefined);
          quick.dispose();
        });
        quick.show();
      });

      if (value === undefined) return;
      await store.update(targets, { tag: value });
    })
  );

  // --- description ---------------------------------------------------------
  register('fileMarks.setDescription', (uri, uris) =>
    withTargets(uri, uris, async (targets) => {
      const current = targets.length === 1 ? (store.get(targets[0]) || {}).description : '';

      const value = await vscode.window.showInputBox({
        title: `Description → ${describeTargets(targets)}`,
        prompt: 'Shown when hovering the item in the Explorer (empty clears it)',
        value: current || '',
      });
      if (value === undefined) return;
      await store.update(targets, { description: value.trim() || null });
    })
  );

  // --- remove --------------------------------------------------------------
  register('fileMarks.clear', (uri, uris) =>
    withTargets(uri, uris, (targets) => store.remove(targets))
  );
}

module.exports = { registerMarkCommands };
