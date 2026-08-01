'use strict';

const vscode = require('vscode');

const { COLORS, BADGE_SUGGESTIONS } = require('../constants');
const { sanitizeTag } = require('../badge');
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
        await vscode.commands.executeCommand(picked.action, uri, uris);
        return;
      }

      const preset = picked.preset;
      await store.update(targets, {
        color: preset.color || null,
        tag: sanitizeTag(preset.badge) || null,
        description: preset.description || null,
      });
    })
  );

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
