'use strict';
/**
 * Unit tests for src/i18n.js - language set, key symmetry across all
 * seven languages, non-empty values, and the RTL language set.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const i18n = require('../src/i18n');

const EXPECTED_LANGS = ['fa', 'en', 'de', 'ar', 'es', 'ru', 'zh'];

test('languages: exactly fa, en, de, ar, es, ru, zh', () => {
  assert.deepEqual([...i18n.langs].sort(), [...EXPECTED_LANGS].sort());
});

test('key symmetry: every language carries exactly the reference key set', () => {
  const reference = Object.keys(i18n.getI18n('en')).sort();
  assert.ok(reference.length > 0);
  for (const lang of EXPECTED_LANGS) {
    const keys = Object.keys(i18n.getI18n(lang)).sort();
    assert.deepEqual(keys, reference, `language "${lang}" key set differs`);
  }
});

test('values: every string in every language is a non-empty string', () => {
  for (const lang of EXPECTED_LANGS) {
    const dict = i18n.getI18n(lang);
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${lang}.${key} is not a string`);
      assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
    }
  }
});

test('substitution placeholders: {name}-style tokens match across languages', () => {
  const tokensOf = (s) => (s.match(/\{[a-zA-Z]+\}/g) || []).sort();
  const en = i18n.getI18n('en');
  for (const lang of EXPECTED_LANGS) {
    const dict = i18n.getI18n(lang);
    for (const key of Object.keys(en)) {
      assert.deepEqual(tokensOf(dict[key]), tokensOf(en[key]),
        `${lang}.${key} placeholders differ from en`);
    }
  }
});

test('feature keys: auto-caption badge and priority actions in every language', () => {
  const badge = {
    fa: 'خودکار', en: 'Auto', de: 'Auto', ar: 'تلقائي', es: 'Auto', ru: 'Авто', zh: '自动',
  };
  for (const lang of EXPECTED_LANGS) {
    const dict = i18n.getI18n(lang);
    assert.equal(dict.subAuto, badge[lang], `${lang}.subAuto`);
    assert.ok(dict.priorityUp, `${lang}.priorityUp missing`);
    assert.ok(dict.priorityDown, `${lang}.priorityDown missing`);
  }
});

test('RTL: only fa and ar are right-to-left', () => {
  assert.equal(i18n.isRtl('fa'), true);
  assert.equal(i18n.isRtl('ar'), true);
  for (const lang of ['en', 'de', 'es', 'ru', 'zh']) {
    assert.equal(i18n.isRtl(lang), false, `${lang} must be LTR`);
  }
});

test('lookup: getI18n returns the requested dictionary; t() translates and substitutes', () => {
  assert.equal(i18n.getI18n('de').appName, 'KamanTube');
  i18n.setLang('en');
  assert.equal(i18n.lang(), 'en');
  assert.equal(i18n.t('appName'), 'KamanTube');
  assert.equal(i18n.t('noSuchKeyAnywhere'), 'noSuchKeyAnywhere'); // falls back to the key
  i18n.setLang('fa');
});
