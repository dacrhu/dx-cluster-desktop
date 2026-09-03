# Translating DX Cluster Desktop

The whole interface is translatable. You do **not** need any programming
knowledge to add or fix a translation — you only edit text files on GitHub and
open a pull request.

The app currently ships **English**, **Hungarian** (Magyar) and **German**
(Deutsch).

## How the translations are stored

Every piece of visible text has a short **key** and a **value** per language:

```
src/i18n/locales/
  en.json   ← English — the master list, always complete
  hu.json   ← Hungarian
  de.json   ← German
```

Each file is a simple list of `"key": "text"` pairs:

```json
{
  "common.send": "Send",
  "tab.spots": "Spots",
  "ann.searchPlaceholder": "search announcements…",
  "header.online": "{n} connection(s) live"
}
```

Rules:

- **Only translate the part on the right** (the value, in quotes).
- **Never change the key** (the part on the left) — it must stay identical in
  every language file, or that text will fall back to English.
- Keep the punctuation and spaces that are part of the text, e.g. the trailing
  `…` or `:` .
- `{n}`, `{cmd}`, `{call}`, `{group}`, `{d}` … are **placeholders** the app fills
  in at runtime. Keep them exactly as written; you may move them within the
  sentence so the grammar works.
- Keep the JSON valid: every line inside `{ … }` ends with a comma **except the
  last one**, and every value is wrapped in `"double quotes"`. If a value
  contains a quote character, write it as `\"`.

## Fixing an existing translation

1. On GitHub, open `src/i18n/locales/hu.json` (or `de.json`).
2. Click the pencil ✏️ icon ("Edit this file").
3. Change the wrong text.
4. At the bottom choose "Create a new branch and start a pull request", and
   submit. That's it.

## Completing a translation

If English has a key that a language file is missing, that text shows up in
English. To fix it, copy the `"key": "value"` line from `en.json` into the same
place in the other file and translate the value.

Tip: the three files are kept in the **same order**, so you can compare them
side by side.

## Adding a brand-new language

1. Copy `src/i18n/locales/en.json` to `src/i18n/locales/<code>.json`, where
   `<code>` is the 2-letter language code (e.g. `fr` for French, `es` for
   Spanish, `it` for Italian).
2. Translate every value in the new file (leave the keys untouched).
3. Edit `src/i18n/index.ts` and add the language in three spots — copy how `de`
   is done:
   - `import <code>Json from "./locales/<code>.json";` near the top
   - `export type LangCode = "en" | "hu" | "de" | "<code>";`
   - `const DICTS = { en, hu: huJson as Dict, de: deJson as Dict, <code>: <code>Json as Dict };`
   - `export const LANGUAGES = [ …, { code: "<code>", label: "<Native name>" } ];`
   - in `resolveLang`, add your code to the two checks (`pref === "<code>"` and
     the `sys === …` line) if you want it auto-selected from the OS language.
4. Open a pull request. A maintainer will verify the `index.ts` change builds.

## Checking your work (optional)

If you can run the project locally:

```sh
pnpm install
pnpm build      # fails if a JSON file is broken
pnpm dev        # try the app, switch language in Connection → Settings
```

Otherwise just open the pull request — the CI build will flag a broken file and
a maintainer will help.
