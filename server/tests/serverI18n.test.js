import test from 'node:test';
import assert from 'node:assert/strict';
import { getLang, msg, MESSAGES } from '../services/serverI18n.js';

test('Accept-Language: yalnizca tr ile baslayan Turkce, gerisi Ingilizce', () => {
  assert.equal(getLang({ headers: { 'accept-language': 'tr' } }), 'tr');
  assert.equal(getLang({ headers: { 'accept-language': 'tr-TR,tr;q=0.9,en;q=0.8' } }), 'tr');
  assert.equal(getLang({ headers: { 'accept-language': 'en-US' } }), 'en');
  assert.equal(getLang({ headers: {} }), 'en');
  assert.equal(getLang(undefined), 'en');
});

test('TR ve EN sozlukleri ayni anahtarlara sahip', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  assert.deepEqual(keys(MESSAGES.tr), keys(MESSAGES.en));
});

test('yer tutucular doldurulur, bilinmeyen dil Ingilizceye duser', () => {
  assert.equal(msg('en', 'warnings.noSuchProfile', { id: 'x' }), 'There is no profile called "x"; the default was used.');
  assert.equal(msg('de', 'profiles.dengeli.label'), 'Balanced');
});
