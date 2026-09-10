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

## Translating the user manual

The user manual (the pages you read in the app's _Help_ tab, and on GitHub under
[`user-manual/`](user-manual/)) is translated separately, one Markdown file per
page:

```
user-manual/
  en/   ← English — the source of truth, always complete
  hu/   ← Hungarian
  de/   ← German
```

- Each language directory has the **same file names** (`getting-started.md`,
  `spots.md`, …) and its own `README.md` (the table of contents).
- To translate a page, copy it from `user-manual/en/<page>.md` to
  `user-manual/<code>/<page>.md` and translate the prose. **Keep the Markdown
  structure** — headings, lists, tables, links, and anything in `` `code font` ``
  (command names, `dx:` query tokens, setting names) stays as-is.
- Links between pages are plain relative names (`[Spots](spots.md)`) — leave them
  exactly as written; they resolve within the same language directory.
- You do **not** have to translate every page at once. A page missing in your
  language automatically falls back to the English one, and the app shows a small
  "showing the English version" note above it.
- No code change is needed to add manual pages for an existing UI language.
  Adding a manual for a brand-new language also needs a one-line bundling glob in
  `src-tauri/tauri.conf.json` (copy the `hu` / `de` lines) — a maintainer can do
  that.

## Checking your work (optional)

If you can run the project locally:

```sh
pnpm install
pnpm build      # fails if a JSON file is broken
pnpm dev        # try the app, switch language in Connection → Settings
```

Otherwise just open the pull request — the CI build will flag a broken file and
a maintainer will help.
