'use strict';

const { COLORS, COLOR_ID } = require('./constants');
const { sanitizeTag, sanitizeDescription } = require('./badge');

/** `red` and `contrast` both reach `fileMarks.red` / `fileMarks.white`. */
const SHORT_COLOR_NAMES = new Map();
for (const color of COLORS) {
  SHORT_COLOR_NAMES.set(color.id.replace(/^fileMarks\./, '').toLowerCase(), color.id);
  SHORT_COLOR_NAMES.set(color.label.toLowerCase(), color.id);
}

const COLOR_NAME_LIST = COLORS.map((c) => c.id.replace(/^fileMarks\./, '')).join(', ');

/** Values that mean "take this part of the mark away". */
function isClearing(value) {
  return value === null || value === '' || value === false || value === 'none';
}

/**
 * A colour a keybinding asked for: a short name (`red`), one of our ids
 * (`fileMarks.red`) or any other theme colour id, which is left to the store to
 * validate.
 *
 * @param {unknown} value
 * @returns {string | null | undefined} undefined when it is not a colour at all
 */
function resolveColor(value) {
  if (isClearing(value)) return null;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  const short = SHORT_COLOR_NAMES.get(trimmed.toLowerCase());
  if (short) return short;
  return COLOR_ID.test(trimmed) ? trimmed : undefined;
}

/**
 * @param {readonly any[]} presets from `fileMarks.presets`
 * @param {unknown} ref a 1-based position in the list or a label
 */
function findPreset(presets, ref) {
  if (typeof ref === 'number') return Number.isInteger(ref) ? presets[ref - 1] : undefined;
  if (typeof ref !== 'string') return undefined;

  const wanted = ref.trim().toLowerCase();
  if (/^\d+$/.test(wanted)) return presets[Number(wanted) - 1];
  return presets.find((p) => String(p.label).toLowerCase() === wanted);
}

/**
 * A preset defines the whole mark, so the parts it leaves out are cleared rather
 * than kept from whatever was there before.
 *
 * @param {any} preset an entry of `fileMarks.presets`
 * @returns {Record<string, string | null>}
 */
function presetPatch(preset) {
  const color = resolveColor(preset.color);
  return {
    color: color === undefined ? null : color,
    tag: sanitizeTag(preset.badge) || null,
    description: sanitizeDescription(preset.description) || null,
  };
}

/**
 * Turns the `args` object of a keybinding into a patch for the store. Every part
 * is optional and each one can also be cleared, so a single command covers
 * "colour it red", "give it a badge", "drop the note" and any combination.
 *
 * @param {Record<string, unknown>} options
 * @param {readonly any[]} presets
 * @returns {{ patch?: Record<string, string | null>, error?: string }}
 */
function buildPatch(options, presets) {
  /** @type {Record<string, string | null>} */
  const patch = {};

  if (options.preset !== undefined && !isClearing(options.preset)) {
    const preset = findPreset(presets, options.preset);
    if (!preset) {
      return { error: `no preset ${JSON.stringify(options.preset)} in fileMarks.presets` };
    }
    Object.assign(patch, presetPatch(preset));
  }

  if ('color' in options) {
    const color = resolveColor(options.color);
    if (color === undefined) {
      return { error: `${JSON.stringify(options.color)} is not a colour — use one of ${COLOR_NAME_LIST}` };
    }
    patch.color = color;
  }

  const badge = 'badge' in options ? options.badge : options.tag;
  if (badge !== undefined) {
    if (isClearing(badge)) patch.tag = null;
    else {
      const tag = sanitizeTag(badge);
      if (!tag) return { error: `${JSON.stringify(badge)} cannot be used as a tag` };
      patch.tag = tag;
    }
  }

  if (options.description !== undefined) {
    patch.description = isClearing(options.description)
      ? null
      : sanitizeDescription(options.description) || null;
  }

  if (Object.keys(patch).length === 0) return {};
  return { patch };
}

/**
 * True when every field the patch sets is already exactly that on every target —
 * the case where pressing the same key again should undo the mark instead of
 * writing it a second time.
 *
 * @param {import('./markStore').MarkStore} store
 * @param {readonly import('vscode').Uri[]} targets
 * @param {Record<string, string | null>} patch
 */
function alreadyApplied(store, targets, patch) {
  const fields = Object.entries(patch);
  if (fields.every(([, value]) => value === null)) return false;

  return targets.every((uri) => {
    const mark = store.get(uri) || {};
    return fields.every(([field, value]) => (mark[field] || null) === value);
  });
}

/** The same patch with every field cleared. */
function clearingPatch(patch) {
  /** @type {Record<string, null>} */
  const out = {};
  for (const field of Object.keys(patch)) out[field] = null;
  return out;
}

module.exports = { presetPatch, buildPatch, alreadyApplied, clearingPatch };
