'use strict';

/**
 * Colour ids must match `contributes.colors` in package.json.
 * The label is the only thing shown in the picker — no emoji swatches, the
 * name already says which colour it is.
 */
const COLORS = [
  { id: 'fileMarks.red', label: 'Red' },
  { id: 'fileMarks.orange', label: 'Orange' },
  { id: 'fileMarks.yellow', label: 'Yellow' },
  { id: 'fileMarks.green', label: 'Green' },
  { id: 'fileMarks.teal', label: 'Teal' },
  { id: 'fileMarks.blue', label: 'Blue' },
  { id: 'fileMarks.purple', label: 'Purple' },
  { id: 'fileMarks.pink', label: 'Pink' },
  { id: 'fileMarks.grey', label: 'Grey' },
  { id: 'fileMarks.white', label: 'Contrast' },
];

/** Fallback badge suggestions when `fileMarks.badgeSuggestions` is empty. */
const BADGE_SUGGESTIONS = [
  '📌', '⭐', '🚧', '✅', '💥', '🚫', '❓', '🗄', '🔥', '🐞',
  '💡', '🔒', '👀', '⚡', '🧪', '📝', '♻', '🎯', '1', '2',
];

/** Hover notes are trimmed to this, so a broken file cannot produce a huge tooltip. */
const MAX_DESCRIPTION_LENGTH = 500;

const STORAGE_FILE = 'marks.json';

/** Global storage folder used before the extension got a real publisher id. */
const LEGACY_STORAGE_DIRS = ['local.file-marks'];

module.exports = {
  COLORS,
  BADGE_SUGGESTIONS,
  MAX_DESCRIPTION_LENGTH,
  STORAGE_FILE,
  LEGACY_STORAGE_DIRS,
};
