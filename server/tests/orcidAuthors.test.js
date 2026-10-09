import test from 'node:test';
import assert from 'node:assert/strict';

import { parseOrcidId, buildAffiliationQuery, parseAffiliations, isOrcidEnabled, MAX_ENRICH_IDS } from '../services/orcid.js';
import { toAuthorCandidates, mergeInstitutionFirst } from '../services/openalex.js';

test('ORCID iD her yazimla taniniyor', () => {
  assert.equal(parseOrcidId('0000-0002-1594-3680'), '0000-0002-1594-3680');
  assert.equal(parseOrcidId(' https://orcid.org/0000-0002-1594-3680 '), '0000-0002-1594-3680');
  assert.equal(parseOrcidId('orcid.org/0000-0002-1594-3680'), null, 'semasiz adres ORCID sayilmaz');
  assert.equal(parseOrcidId('0000000215943680'), '0000-0002-1594-3680');
  // ORCID dokumantasyonundaki X sagla haneli ornek.
  assert.equal(parseOrcidId('0000-0002-1694-233x'), '0000-0002-1694-233X');
});

test('sagla hanesi tutmayan veya bicim disi deger ORCID sayilmiyor', () => {
  assert.equal(parseOrcidId('0000-0002-1594-3681'), null);
  assert.equal(parseOrcidId('Ahmet Yilmaz'), null);
  assert.equal(parseOrcidId('0000-0002-1594'), null);
  assert.equal(parseOrcidId(''), null);
  assert.equal(parseOrcidId(undefined), null);
});

test('zenginlestirme sorgusu: gecersizler atilir, tekrarlar birlesir, sinir uygulanir', () => {
  assert.equal(buildAffiliationQuery([]), null);
  assert.equal(buildAffiliationQuery(['abc', '0000-0002-1594-3681']), null);
  const built = buildAffiliationQuery(['0000-0002-1594-3680', 'https://orcid.org/0000-0002-1594-3680', 'x', '0000-0002-1694-233X']);
  assert.deepEqual(built.ids, ['0000-0002-1594-3680', '0000-0002-1694-233X']);
  assert.equal(built.q, 'orcid:(0000-0002-1594-3680 OR 0000-0002-1694-233X)');
  const many = Array.from({ length: 15 }, () => '0000-0002-1594-3680').concat(['0000-0002-1694-233X']);
  assert.ok(buildAffiliationQuery(many).ids.length <= MAX_ENRICH_IDS);
});

test('kurum gecmisi: Turkce harf ve birlesik nokta farki tekrar sayilmiyor, en fazla 4', () => {
  const out = parseAffiliations({
    'expanded-result': [
      {
        'orcid-id': '0000-0002-1594-3680',
        'institution-name': ['Hacettepe Üniversitesi', 'HACETTEPE ÜNİVERSİTESİ', 'Hacettepe Universitesi', 'Mi̇lli̇ Eği̇ti̇m', 'Milli Eğitim', 'A', 'B', 'C', ''],
      },
      { 'orcid-id': 'bozuk', 'institution-name': ['X'] },
    ],
  });
  assert.deepEqual(Object.keys(out), ['0000-0002-1594-3680']);
  assert.deepEqual(out['0000-0002-1594-3680'], ['Hacettepe Üniversitesi', 'Mi̇lli̇ Eği̇ti̇m', 'A', 'B']);
  assert.deepEqual(parseAffiliations({ 'expanded-result': null }), {});
  assert.deepEqual(parseAffiliations(null), {});
});

test('NULL ve silinmis OpenAlex yazar kayitlari listeye girmiyor', () => {
  const out = toAuthorCandidates([
    { id: 'https://openalex.org/A9999999999', display_name: 'NULL AUTHOR_ID' },
    { id: 'https://openalex.org/A5317838346', display_name: 'deleted' },
    { id: 'https://openalex.org/A5034625040', display_name: 'Ahmet Fatih Yılmaz', orcid: 'https://orcid.org/0000-0002-1594-3680' },
    { id: 'https://openalex.org/I66514158', display_name: 'kurum, yazar degil' },
  ]);
  assert.deepEqual(out.map((a) => a.id), ['A5034625040']);
  assert.equal(out[0].orcid, '0000-0002-1594-3680');
});

test('bayrak yalnizca "true" ile aciliyor', () => {
  assert.equal(isOrcidEnabled({}), false);
  assert.equal(isOrcidEnabled({ ORCID_ENABLED: 'false' }), false);
  assert.equal(isOrcidEnabled({ ORCID_ENABLED: '1' }), false);
  assert.equal(isOrcidEnabled({ ORCID_ENABLED: 'true' }), true);
});

test('kurum birlestirmesi: eslesenler once, tekrar yok, kimliksiz kayit atlanir, sinir uygulanir', () => {
  const p = (id) => ({ id, name: id });
  const out = mergeInstitutionFirst([p('A3'), p('A1'), { name: 'kimliksiz' }], [p('A1'), p('A2')]);
  assert.deepEqual(out.map((a) => [a.id, a.institutionMatch]), [['A3', true], ['A1', true], ['A2', false]]);
  assert.equal(mergeInstitutionFirst([], Array.from({ length: 20 }, (_, i) => p(`A${i}`)), 12).length, 12);
  assert.deepEqual(mergeInstitutionFirst(), []);
});
