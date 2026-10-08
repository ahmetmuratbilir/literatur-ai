import test from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateResults } from '../services/searchRankingService.js';

// Gercek ornekler: Aziz Sancar'in OpenAlex kayitlari (A5016678671).

test('ayni baslikli, DOI ve yili farkli iki makale birlestirilmez', () => {
  const out = deduplicateResults([
    { title: 'DNA EXCISION REPAIR', year: 1996, doi: '10.1146/annurev.bi.65.070196.000355' },
    { title: 'DNA excision repair', year: 2012, doi: '10.4161/cc.21126' },
  ]);
  assert.equal(out.length, 2);
});

test('ayni yilin ayni baslikli iki kaydi (ozet kaydi, ikinci DOI) birlesir', () => {
  const out = deduplicateResults([
    { title: 'Structure and Function of DNA Photolyase and Cryptochrome Blue-Light Photoreceptors', year: 2003, doi: '10.1021/cr0204348' },
    { title: 'Structure and Function of DNA Photolyase and Cryptochrome Blue‐Light Photoreceptors', year: 2003, doi: '10.1002/chin.200332276' },
  ]);
  assert.equal(out.length, 1);
});

test('yili bilinmeyen kayitta baslik benzerligi eskisi gibi birlestirir', () => {
  const out = deduplicateResults([
    { title: 'Nucleotide excision repair in mammalian cells', doi: '10.1/a' },
    { title: 'Nucleotide Excision Repair in Mammalian Cells', year: 2005, doi: '10.1/b' },
  ]);
  assert.equal(out.length, 1);
});
