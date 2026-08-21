# Changelog

## 1.9.4 - 2026-08-21

### Improved

- Simplified segmented Sentence result-history labels by displaying only the
  natural joined Sentence text, e.g. `an angio/scope` is shown as
  `an angioscope`, while preserving slash-based gameplay segmentation.

## 1.9.3 - 2026-08-16

### Improved

- Made checked Sentence fields compact and removed per-word correctness icons
  while preserving green, neutral, and red feedback, existing hints, and the
  compact icon-free presentation of correct fields after Try again.
- Added ordered green guessed-Sentence and red not-guessed-Sentence result
  chips in play and Summary, with saved-state compatibility.
- Normalized `&#039;`, `&#39;`, and `&apos;` to literal apostrophes throughout
  Sentence runtime and history output while retaining safe plain-text rendering.
- Widened the Summary area and kept its action buttons compact, centered, and
  spaced below the results.
- Prevented the Sentence-only View Summary setting from affecting Wordle and
  removed extra padding from correct Wordle cells.
- Skipped unnecessary Summary confirmation for completed items and limited
  Reset confirmation to games with unfinished selected items.

## 1.9.2 - 2026-08-13

### Improved

- Added the finite Wordle attempt limit to the Round display while keeping
  learner-supplied Wordle with No limit and Sentence mode on the existing
  current-round-only display.
- Updated wrong Wordle inputs to use the current H5P theme incorrect-feedback
  colors.
- Added neutral, icon-free feedback for partially correct Sentence answers
  whose first character matches, while preserving hints, retry, Help, and
  scoring behavior.

## 1.9.1 - 2026-08-11

### Improved

- Refined spacing, dark-theme input borders, misplaced-letter feedback,
  supplied-answer positioning, and summary-table text using H5P theme styles.
- Updated sentence Help authoring labels and explanatory text in English,
  French, and Portuguese localizations.
- Hid the sentence round-limit setting in Wordle while preserving its stored
  value, and made Wordle View Summary use an effective one-round minimum
  without changing sentence-mode limits or Wordle Show solution behavior.

## 1.9.0 - 2026-08-10

### Added

- Added progressive sentence Help as a post-Check action that reveals one
  current leftmost unresolved word at a time while preserving the established
  retry, scoring, accessibility, and Wordle Show solution behavior.

### Improved

- Replaced the vertical Wordle result history with compact, responsive
  found/not-found chips using H5P theme feedback colors, tick/cross glyphs,
  localized accessible statuses, and preserved play order and Continue
  lifecycle behavior.

## 1.8.2 - 2026-08-09

### Fixed

- Replaced Continue's host-page reload with portable in-place continuation,
  fixing the Moodle core Save Content State race after View Summary → Continue.
- Preserved completed word and sentence history, configured selections,
  feedback, scoring, focus, and resize behavior across Continue.
- Prevented timer and round double accounting and stopped the timer while the
  Summary is displayed.
- Restored completed-items visibility after Continue.
- Added Continue lifecycle regression tests.

## 1.8.1 - 2026-08-08

### Fixed

- Fixed learner-supplied Wordle and sentence modes when configured lists are
  empty, and assigned stable IDs to learner-created questions.
- Fixed View Summary and answered-xAPI failures for learner-supplied items.
- Corrected numeric ordering in the sentence word-count selector.
- Fixed malformed `role="group"` accessibility markup.
- Removed an accidental global `$content` assignment and corrected the
  dormant xAPI instance receiver.
- Cleared the incomplete-answer warning when learners resume input.
- Requested a resize when the timer first appears so controls are not clipped.
- Cleaned the existing source formatting and lint baseline.

### Maintenance

- Updated the transitive `fast-uri` dependency from 3.1.4 to 3.1.5.

## 1.8.0 - 2026-08-01

### New

- Added an optional learner-facing selector for the Wordle mystery-word length.
- Only lengths present in the usable configured word list are offered.
- Word-list validation continues to accept every configured word in the
  complete selected-length pool, including words outside the active maximum-20
  subset.

### Improved

- Added responsive, accessible word-length controls and localized the new
  editor and learner strings in English, French, Portuguese, Brazilian
  Portuguese, and European Portuguese.
- Completed and corrected older Portuguese Wordle translations.
- Corrected learner-supplied Wordle descriptions that referred to sentences
  instead of words.

### Compatibility

- Existing content remains compatible; word-length selection is disabled by
  default.
- Learner item-count selection takes priority when both selectors are enabled.
- Sentence mode and learner-supplied-word mode are unchanged.
- Valid saved selections restore their chosen length and active subset; stale
  selections safely return to the length selector.
- Requires H5P Core API 1.28.

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
