# H5P GuessIt

H5P GuessIt is a custom H5P question type for guessing words and sentences. In
sentence mode, learners complete a phrase word by word. In Wordle mode, they
guess a four-to-eight-letter word one character at a time and receive correct,
misplaced, and incorrect letter feedback.

## Features

- Author-provided sentence and word lists, or a play mode where learners enter
  an item for another player to guess.
- Configurable tips, audio, answer case sensitivity, item order, attempt limits,
  solution access, and a final summary.
- Wordle comparison that accepts Western European accented letters and their
  unaccented equivalents while preserving the canonical accented spelling.
- Optional Wordle validation that restricts submitted guesses to the complete
  configured mystery-word list without consuming a turn for rejected words.
- Continue and Reset controls for unfinished games.
- Optional learner selection of the number of items used in a game.
- Optional learner selection of the Wordle mystery-word length from the
  lengths available in the configured usable word list.
- Responsive H5P new-look controls with accessible labels and keyboard support.
- Previous-state restoration when Save Content State is supported and enabled
  by the hosting H5P integration.

To keep the activity responsive, each game uses at most 20 items. When learner
item selection is enabled, **All** is offered only for lists containing 20 items
or fewer. With larger lists, normal order uses the first 20 items and random
order draws 20 items from the complete pool.

## Compatibility and Installation

H5P GuessIt 1.8 requires H5P Core API 1.28. It has been tested successfully on
current WordPress and Moodle installations that support Core API 1.28.

Current Lumi releases are not compatible because they do not yet support H5P
Core API 1.28. This limitation is expected and does not indicate a problem with
the GuessIt package.

The release asset is a library-only H5P package. Install
`H5P.GuessIt-1.8.2.h5p` through the platform's H5P library administration
interface. Do not import it as ordinary learner content.

## Development

Source JavaScript and CSS live under `src/`. Webpack generates the runtime files
in `dist/`.

```bash
npm ci
npm run watch
npm test
npm run lint
npm run build
```

Use `npm run watch` during local H5P development. Run the tests, lint check, and
production build before packaging or publishing the library.

### Existing ESLint Baseline

The current ESLint failures predate version 1.6.0. With the repository's
`.eslintrc.json`, the baseline is 119 errors in `guessit-blanks.js`: 114
indentation errors, four trailing-space errors, and one `no-undef` finding for
`$content`. This baseline is intentionally deferred; `npm run lint` does not
currently pass. Avoid broad formatting changes when addressing it.

## License

H5P GuessIt is distributed under the MIT License.
