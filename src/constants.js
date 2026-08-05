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

/**
 * The shape of a theme colour id. Keybindings and the storage file are both
 * user written, so a colour is only ever handed to the theme when it looks like
 * an id — our own ten are not the only ones a mark may point at.
 */
const COLOR_ID = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;

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
  COLOR_ID,
  BADGE_SUGGESTIONS,
  MAX_DESCRIPTION_LENGTH,
  STORAGE_FILE,
  LEGACY_STORAGE_DIRS,
};
