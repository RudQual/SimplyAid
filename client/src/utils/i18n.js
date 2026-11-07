import translations from './translations';

const STORAGE_KEY = 'simplyaid_lang';

const readStored = () => {
  try { return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
};

// Module-level copy of the active language, so plain helpers such as
// labelize() and timeAgo() can translate without React hooks. AuthContext
// keeps it in sync and re-renders consumers when it changes.
let current = readStored();

const lookup = (lang, path) => {
  let val = translations[lang];
  for (const k of path.split('.')) val = val?.[k];
  return typeof val === 'string' ? val : undefined;
};

const fill = (str, vars) => (vars ? str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : str);

export const getLang = () => current;

/** True once the person picked a language on this device. */
export const hasStoredLang = () => { try { return Boolean(localStorage.getItem(STORAGE_KEY)); } catch { return false; } };

export const setLang = (lang) => {
  current = lang === 'hi' ? 'hi' : 'en';
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* storage may be blocked */ }
  document.documentElement.lang = current;
};

/** A notification's title/message in the active language, when the server sent a Hindi copy. */
export const notifText = (n, field) => (current === 'hi' && n[`${field}Hi`]) || n[field];

/** Translate `path` in the given language, falling back to English, then to `fallback` or the key. */
export const translate = (lang, path, vars, fallback) => fill(lookup(lang, path) ?? lookup('en', path) ?? fallback ?? path, vars);

/** Translate with the active language. */
export const tr = (path, vars, fallback) => translate(current, path, vars, fallback);

/** Hindi label for a status-like value, or undefined when English is active or none exists. */
export const hindiLabel = (value) => (current === 'hi' ? lookup('hi', `labels.${value}`) : undefined);

document.documentElement.lang = current;
