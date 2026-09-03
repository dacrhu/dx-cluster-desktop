import { useCluster } from "@/store/useCluster";
import enJson from "./locales/en.json";
import huJson from "./locales/hu.json";
import deJson from "./locales/de.json";

export type LangCode = "en" | "hu" | "de";
export type LangPref = "system" | LangCode;

type Dict = Record<string, string>;

const en = enJson as Dict;
const DICTS: Record<LangCode, Dict> = { en, hu: huJson as Dict, de: deJson as Dict };

export const LANGUAGES: { code: LangCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hu", label: "Magyar" },
  { code: "de", label: "Deutsch" },
];

// The OS UI locale, set once at startup from the `system_locale` Tauri command
// (navigator.language is unreliable on Linux/WebKitGTK). Until then we fall back
// to navigator.language.
let osLocale: string | null = null;

/** Record the OS locale (e.g. "hu-HU"); call `setActiveLang` again afterwards. */
export function setSystemLocale(locale: string | null): void {
  osLocale = locale;
}

/** Resolve a stored preference (incl. "system") to a concrete language code. */
export function resolveLang(pref: LangPref): LangCode {
  if (pref === "en" || pref === "hu" || pref === "de") return pref;
  const src = osLocale || navigator.language || "en";
  const sys = src.slice(0, 2).toLowerCase();
  return sys === "hu" || sys === "de" ? sys : "en";
}

let active: LangCode = resolveLang("system");

export function setActiveLang(pref: LangPref): void {
  active = resolveLang(pref);
}

/** Translate `key`, with `{name}` interpolation from `params`. Falls back to
 *  English, then to the key itself. */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = DICTS[active][key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** Hook: re-renders the component when the language changes; returns `t`. */
export function useT(): typeof t {
  // subscribe to lang (and the OS locale, which feeds `lang = system`) so
  // components update on change
  useCluster((s) => s.lang);
  useCluster((s) => s.sysLocale);
  return t;
}
