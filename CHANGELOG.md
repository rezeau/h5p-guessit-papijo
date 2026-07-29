# Changelog

## 1.7.1 - 2026-07-29

### Fixed

- Repacked the release archive without explicit ZIP directory entries, fixing
  WordPress installation failures caused by the forbidden
  `H5PEditor.VerticalTabs-1.3/styles/` entry in the published 1.7.0 archive.
- No runtime or content-model behavior changed from 1.7.0.

## 1.7.0 - 2026-07-29

### New

- Added optional Wordle validation requiring submitted guesses to belong to
  the complete configured mystery-word list.
- Rejected words do not consume a turn or reveal new letter-position
  information.
- Added an accessible rejected-word retry flow. Check is replaced by Try again,
  previously established correctly placed letters are preserved, all other
  letters are cleared, the round count remains unchanged, and keyboard
  activation works with Enter and Space.

### Fixed

- Fixed crashes in learner-supplied sentence and Wordle modes when the
  configured item list is empty, missing, or malformed.
- Added Unicode-aware PHP/WordPress semantic validation for composed accented
  words such as “précéder”.
- Fixed false “No usable words or sentences are available” warnings while
  learner item-count selection is pending.
- Added graceful accessible handling when an active configured-list mode
  genuinely contains no usable items.
- Clarified that learner item-count selection takes priority when both
  sentence-selection options are enabled.

### Compatibility

- Existing content remains compatible.
- Word-list validation is disabled by default.
- Non-Wordle modes and learner-supplied-word mode are unaffected.
- Composed NFC accented author input is supported; decomposed NFD author input
  is not claimed as supported.
- Requires H5P Core API 1.28.

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
