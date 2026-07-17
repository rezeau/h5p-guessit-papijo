## Feasibility: **high**

Your existing Wordle implementation is already organised around one-character inputs and the three required states—correct, misplaced and wrong—through `.wordle`, `.h5p-correct-wordle`, `.h5p-misplaced` and `.h5p-wrong-wordle`. Therefore, accented French support should require **mainly JavaScript and validation changes**, not a redesign of the interface or CSS.

The best implementation would accept both:

* the correctly accented spelling: `ÉTÉ`
* the convenient unaccented spelling: `ETE`

while retaining the accented form entered by the author as the **canonical answer**.

## Recommended behaviour

Suppose the answer is:

```text
ÉTAGE
```

The learner enters:

```text
ETAPE
```

For Wordle evaluation, GuessIt would compare:

```text
ETAPE
ETAGE
```

because `É` is folded to `E`.

The resulting states would therefore be:

```text
E  T  A  P  E
🟩 🟩 🟩 ⬛ 🟩
```

After evaluation, the first green `E` could automatically change to the canonical accented form:

```text
É  T  A  P  E
```

When the whole word is accepted, the displayed answer should always become:

```text
ÉTAGE
```

That gives the elegant compromise you described:

* learners do not need convenient access to accented keyboard characters;
* learners who type accents are accepted normally;
* the final displayed word respects correct French spelling.

## The essential technical change

You need to keep two versions of every word:

```js
canonicalAnswer = 'ÉTAGE'; // Used for display
comparisonAnswer = 'ETAGE'; // Used for Wordle evaluation
```

A suitable helper would be:

```js
const normalizeForComparison = (text) => {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleUpperCase('fr-FR');
};
```

Examples:

```js
normalizeForComparison('é') === 'E';
normalizeForComparison('è') === 'E';
normalizeForComparison('ê') === 'E';
normalizeForComparison('ë') === 'E';

normalizeForComparison('ç') === 'C';
normalizeForComparison('ù') === 'U';
normalizeForComparison('ï') === 'I';
```

Before splitting a word into its individual Wordle cells, it should first be converted back to composed Unicode:

```js
const canonicalLetters = Array.from(
  answer.normalize('NFC').toLocaleUpperCase('fr-FR')
);
```

Using `normalize('NFC')` avoids treating an accented letter entered as a base letter plus a combining accent as two characters.

## Wordle evaluation must use normalized letters

This is the most important point.

Do not apply normalization only when deciding whether the complete word is correct. It must also be applied when calculating:

* green letters;
* yellow letters;
* absent letters;
* repeated-letter counts.

For example, with answer:

```text
ÉLEVÉ
```

all of these must belong to the same Wordle letter family:

```text
E É È Ê Ë
```

Your duplicate-letter calculation must therefore consume normalized letters. A standard two-pass Wordle algorithm remains suitable:

1. Mark exact-position matches using normalized letters.
2. Count the remaining normalized answer letters.
3. Mark misplaced letters only while a corresponding remaining count exists.

Otherwise accents could break duplicate handling. For example, the program might incorrectly treat `E` and `É` as two independent available letters.

## Retroactive accent correction

There are two reasonable versions.

### Recommended: correct green letters only

When an unaccented letter is green, replace it with the canonical answer character:

```js
if (state === 'correct') {
  input.value = canonicalAnswerLetters[position];
}
```

Thus:

```text
Learner types: E
Correct letter: É
Displayed after checking: É
```

This reveals the accent only after the learner has found the exact position.

### More generous alternative

Correct both green and yellow letters to their accented form. This is also feasible, but it reveals extra information: a yellow `E` might immediately become `É`, even though its position is still unknown.

For GuessIt, I recommend **green-only correction**, followed by replacement of the entire word with its canonical spelling when solved.

## Input acceptance

Any current ASCII-only restriction such as:

```js
/^[A-Z]$/
```

or:

```js
/^[a-zA-Z]$/
```

would reject accented input.

It should become either a Unicode-letter test:

```js
/^\p{L}$/u
```

or, for explicitly French characters:

```js
/^[A-Za-zÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸàâäçéèêëîïôöùûüÿŒœÆæ]$/
```

The input value should then be canonicalised:

```js
const letter = input.value
  .normalize('NFC')
  .toLocaleUpperCase('fr-FR');
```

## Keyboard-event consideration

French accents are often entered using:

* dead keys;
* AltGr;
* mobile keyboards;
* input-method composition.

Therefore, letter filtering should preferably happen on the `input` event rather than rejecting keys in `keydown` or `keypress`.

Code that immediately rejects an accent dead key could prevent characters such as `ê` from ever reaching the input.

If you use `maxlength="1"`, it should normally work with composed accented characters, but the processed value should still be normalised to NFC.

## Authoring validation

The GuessIt semantics must also accept accented words. Otherwise the runtime could support them while the H5P editor rejects them.

Check for restrictions such as:

```json
"regexp": "/^[A-Za-z]+$/"
```

or five-letter forms based exclusively on `[A-Z]`.

For a five-letter French word, an explicit validation could use:

```regex
/^[A-Za-zÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸàâäçéèêëîïôöùûüÿŒœÆæ]{5}$/
```

However, the stored answer should always be NFC-normalised before its length is calculated.

## Ligatures should be treated separately

Accents are straightforward because:

```text
É → E
Ç → C
Ù → U
```

and each remains one Wordle cell.

French ligatures are more complicated:

```text
Œ → OE
Æ → AE
```

Expanding `Œ` to `OE` changes the number of cells. For example:

```text
CŒUR
COEUR
```

have different character counts.

I recommend that the first implementation support accented letters but **not automatically expand `Œ` or `Æ`**. Ligatures can later be handled through a separate author option or explicit accepted-answer mechanism.

## State saving and reporting

GuessIt should distinguish between:

* what the learner entered;
* the normalized comparison form;
* the canonical answer displayed afterward.

For H5P previous-state restoration, storing the original learner entry is preferable. On restoration, it can be normalized again for evaluation. Once the word has been solved, the visible row can be reconstructed from the canonical answer.

For xAPI responses, a sensible policy is:

```text
Learner response: ETE
Correct response: ÉTÉ
Result: correct
```

This preserves an accurate record of what was actually typed.

## Recommended implementation scope

The change would involve approximately these areas:

1. Permit accented letters in editor and runtime validation.
2. Normalize all authored answers to NFC.
3. Normalize learner input to NFC and French uppercase.
4. Create an accent-folded form for Wordle comparisons.
5. Run duplicate-letter evaluation on the folded forms.
6. Keep the original accented answer for display.
7. Replace green letters retroactively with canonical accented letters.
8. Restore the complete canonical spelling when solved.
9. Test input composition, previous-state restoration and xAPI output.

## Conclusion

This is a **very feasible and worthwhile addition** to H5P GuessIt. The safest design is:

> Accented input is accepted, unaccented equivalents are also accepted, Wordle colours are calculated without regard to accents, and correctly positioned letters are changed to the canonical accented spelling.

The existing per-letter Wordle display and state classes already provide the necessary visual structure; the significant work lies in consistent Unicode normalization and repeated-letter evaluation.
