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
- Continue and Reset controls for unfinished games.
- Optional learner selection of the number of items used in a game.
- Responsive H5P new-look controls with accessible labels and keyboard support.
- Previous-state restoration when Save Content State is supported and enabled
  by the hosting H5P integration.

To keep the activity responsive, each game uses at most 20 items. When learner
item selection is enabled, **All** is offered only for lists containing 20 items
or fewer. With larger lists, normal order uses the first 20 items and random
order draws 20 items from the complete pool.

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

## License

H5P GuessIt is distributed under the MIT License.
