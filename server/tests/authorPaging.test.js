import test from 'node:test';
import assert from 'node:assert/strict';

import { guarded, clampAuthorPage, AUTHOR_MAX_PAGE, AUTHOR_SELECT } from '../services/search.js';
import { createBreaker, TIMEOUTS_TO_OPEN } from '../services/sourceBreaker.js';

const timeout = () => Promise.reject(new Error('OpenAlex timeout >12000ms'));

test('yazar sayfasinin zaman asimi kesiciyi acmiyor; konu aramasi OpenAlex\'i kullanmaya devam ediyor', async () => {
  const b = createBreaker();
  for (let i = 0; i < TIMEOUTS_TO_OPEN + 2; i += 1) {
    await guarded('OpenAlex', timeout, b, { countTimeouts: false }).catch(() => {});
  }
  assert.equal(b.check('OpenAlex').skip, false);
});

test('konu aramasinin zaman asimlari kesiciyi yine aciyor', async () => {
  const b = createBreaker();
  for (let i = 0; i < TIMEOUTS_TO_OPEN; i += 1) await guarded('OpenAlex', timeout, b).catch(() => {});
  assert.equal(b.check('OpenAlex').skip, true);
});

test('yazar sayfasinda kota hatasi (429) yine kaydediliyor', async () => {
  const b = createBreaker();
  await guarded('OpenAlex', () => Promise.reject(new Error('OpenAlex API Hatası (429)')), b, { countTimeouts: false }).catch(() => {});
  assert.equal(b.check('OpenAlex').skip, true);
});

test('guarded: verilen sure dolunca reddediyor', async () => {
  const b = createBreaker();
  const err = await guarded('X', () => new Promise(() => {}), b, { deadlineMs: 20 }).catch((e) => e);
  assert.match(err.message, /timeout >20ms/);
});

test('sayfa numarasi 1..son sayfa araligina cekiliyor', () => {
  assert.equal(clampAuthorPage(undefined), 1);
  assert.equal(clampAuthorPage('abc'), 1);
  assert.equal(clampAuthorPage('0'), 1);
  assert.equal(clampAuthorPage('-3'), 1);
  assert.equal(clampAuthorPage('2'), 2);
  assert.equal(clampAuthorPage('999'), AUTHOR_MAX_PAGE);
});

test('alan secimi eslemenin okudugu alanlari iceriyor', () => {
  for (const f of ['id', 'doi', 'title', 'authorships', 'primary_location', 'cited_by_count', 'publication_year', 'abstract_inverted_index', 'open_access']) {
    assert.ok(AUTHOR_SELECT.split(',').includes(f), f);
  }
});
