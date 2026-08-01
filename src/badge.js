'use strict';

const { MAX_DESCRIPTION_LENGTH } = require('./constants');

/**
 * VS Code validates the badge it draws next to a file name with its own
 * grapheme counter and silently drops the *whole* decoration — the colour
 * included — when it is longer than two graphemes. That limit belongs to the
 * editor and cannot be lifted, so a tag is two characters and no more.
 */
const TAG_GRAPHEMES = 2;

/**
 * Two graphemes can still be a long string of code units (a family emoji is
 * eleven). Past this we would be trusting our segmenter to agree with the
 * editor's on an exotic sequence; a badge it rejects costs the whole mark.
 */
const TAG_UNITS = 24;

/**
 * Control characters, bidi overrides and the invisible marks that reorder
 * text. They survive a round trip through the JSON file and can make a tag
 * render as something other than what is stored, so they never enter a mark.
 * ZWJ and the variation selectors are deliberately kept — emoji need them.
 */
const UNSAFE = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]', 'g');

const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined;

/**
 * Splits into user-perceived characters, so an emoji built from several code
 * points counts as one. Falls back to code points where `Intl.Segmenter` is
 * missing.
 *
 * @param {string} text
 * @returns {string[]}
 */
function graphemes(text) {
  if (!segmenter) return Array.from(text);
  const out = [];
  for (const part of segmenter.segment(text)) out.push(part.segment);
  return out;
}

/** @param {unknown} value */
function cleanText(value) {
  return typeof value === 'string' ? value.replace(UNSAFE, '').trim() : '';
}

/**
 * A tag the Explorer will accept: at most two characters, longer input is cut
 * down to the first two.
 *
 * @param {unknown} tag
 * @returns {string | undefined} the tag, or undefined when nothing is left
 */
function sanitizeTag(tag) {
  const clean = cleanText(tag);
  if (!clean) return undefined;

  const parts = graphemes(clean);
  const kept = parts.length <= TAG_GRAPHEMES ? clean : parts.slice(0, TAG_GRAPHEMES).join('').trim();
  if (!kept || kept.length > TAG_UNITS) return undefined;
  return kept;
}

/**
 * @param {unknown} description
 * @returns {string | undefined}
 */
function sanitizeDescription(description) {
  const clean = cleanText(description);
  if (!clean) return undefined;
  return clean.length <= MAX_DESCRIPTION_LENGTH ? clean : clean.slice(0, MAX_DESCRIPTION_LENGTH);
}

module.exports = { sanitizeTag, sanitizeDescription };
