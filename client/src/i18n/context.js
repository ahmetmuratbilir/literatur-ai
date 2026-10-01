import { createContext, useContext } from 'react';
import axios from 'axios';
import en from './en.js';
import tr from './tr.js';

/**
 * Arayüz dili. Varsayılan İngilizce (ürün kararı); kullanıcı TR/EN seçer,
 * tercih tarayıcıda hatırlanır.
 *
 * Kütüphane yok: iki dil ve düz bir anahtar sözlüğü için react-i18next'in
 * getireceği bağımlılık ve yapılandırma gereksiz. `t('a.b', { n: 3 })`
 * sözlükte "a.b" yolundaki metni döndürür, `{n}` yer tutucularını doldurur.
 * Anahtar seçili dilde yoksa İngilizceye, o da yoksa anahtarın kendisine düşer
 * (eksik çeviri ekranda görünür, sessizce kaybolmaz).
 */
export const DICTS = { en, tr };
export const LANGS = ['en', 'tr'];
export const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'uiLang';

export const I18nContext = createContext(null);

export function readStoredLang() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function storeLang(lang) {
  try { window.localStorage.setItem(STORAGE_KEY, lang); } catch { /* gizli pencere */ }
}

/**
 * Dili tarayıcıya ve sunucuya bildirir. Sunucu kullanıcıya dönük metinleri
 * (profil adları, çelişki açıklamaları, uyarılar) Accept-Language'e göre üretir.
 */
export function applyLang(lang) {
  document.documentElement.lang = lang;
  axios.defaults.headers.common['Accept-Language'] = lang;
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node && node[part] !== undefined ? node[part] : undefined), dict);
}

export function translate(lang, key, vars) {
  const value = lookup(DICTS[lang], key) ?? lookup(DICTS[DEFAULT_LANG], key);
  if (typeof value === 'function') return value(vars || {});
  if (typeof value !== 'string') return value ?? key;
  return vars ? value.replace(/\{(\w+)\}/g, (match, name) => (vars[name] ?? match)) : value;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n, I18nProvider içinde kullanılmalı.');
  return ctx;
}
