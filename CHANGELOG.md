# Changelog

## 1.6.0 - 2026-07-24

- Modernized question controls for H5P's new-look interface and added a
  responsive task-description and status header.
- Extended Wordle comparison to Western European accented letters while
  preserving canonical spelling and accepting unaccented equivalents.
- Improved Unicode normalization, repeated-letter scoring, lowercase input,
  and restored-state handling in Wordle mode.
- Added optional learner selection of game length and limited each game to
  20 active items.
- Added Continue and Reset controls for unfinished games and refined summary
  screens and End Game availability.
- Improved accessibility labels, translations, responsive presentation, and
  several display and interaction details.

### Compatibility

- Requires H5P Core API 1.28.
- Tested on current WordPress and Moodle installations supporting Core API
  1.28.
- Current Lumi releases are not compatible because they do not yet support
  H5P Core API 1.28.

### Known Development Issue

- ESLint has an existing pre-1.6.0 baseline of 121 errors in
  `guessit-blanks.js`, predominantly indentation. The remaining non-formatting
  finding is an undeclared `$content` assignment and is deferred for a focused
  correction.
