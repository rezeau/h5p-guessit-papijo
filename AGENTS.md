# Repository Guidelines

## Project Structure & Module Organization

This repository contains the H5P GuessIt content type. Author JavaScript in `src/scripts/`; `src/entries/h5p-guessit.js` is the webpack entry point and imports the scripts and stylesheet. Put styles in `src/styles/` and bundled image resources in `src/images/`. Webpack writes generated JavaScript, CSS, and copied assets to `dist/`; do not edit or commit that directory.

H5P metadata and editor configuration live in `library.json` and `semantics.json`. Translations belong in `language/<locale>.json` (for example, `language/fr.json`). Root-level `images/` contains runtime library assets, while `icon.svg` is the library icon.

## Build, Test, and Development Commands

- `npm ci` installs the exact development dependencies from `package-lock.json`.
- `npm run build` creates a minified production bundle in `dist/` and removes console output.
- `npm run watch` rebuilds development bundles when source files change and includes source maps.
- `npm run lint` checks JavaScript against `.eslintrc.json` with the pinned ESLint version.

There is no automated test command. After building, install or copy the library into an H5P development environment and exercise content creation, answer checking, reset/retry behavior, accessibility labels, and relevant translations. Also verify that `library.json` references the expected files and that `semantics.json` remains valid JSON.

## Coding Style & Naming Conventions

Use ES2020 JavaScript modules, two-space indentation, semicolons, strict equality, and Stroustrup-style braces, as enforced by ESLint. Prefer `const` and `let`; `var` is forbidden. Use descriptive camelCase for variables and functions, PascalCase for constructor-like classes, and existing `h5p-guessit-*` kebab-case selectors for CSS. Preserve the established H5P namespace/IIFE pattern and document public or non-obvious functions with JSDoc.

## Commit & Pull Request Guidelines

Recent history includes short work-in-progress commits and Dependabot-style messages. For new contributions, use concise imperative subjects such as `Fix timer reset after retry`; avoid committing ambiguous `wip` snapshots to shared branches. Keep each commit focused.

Pull requests should explain the user-visible change, identify affected modes or settings, and describe manual verification. Link the relevant issue when available. Include screenshots or a short recording for visual changes, and call out edits to `semantics.json`, translations, or H5P metadata. Run the production build and lint check before requesting review.
