import test from 'node:test';
import assert from 'node:assert/strict';
import { getYearDisplay } from '../src/utils/yearDisplay.js';

const t = (k, p) => `${k}${p?.y ? `:${p.y}` : ''}`;

test('yalnız `year` taşıyan kayıt yılını gösterir (paylaşım, eski geçmiş)', () => {
  assert.equal(getYearDisplay({ year: 2021 }, t).label, '2021');
});

test('publicationYear önceliklidir; metadata yılı yayın yılı sayılmaz', () => {
  assert.equal(getYearDisplay({ publicationYear: 2019, year: 2021 }, t).label, '2019');
  assert.equal(getYearDisplay({ metadataYear: 2024 }, t).label, 'card.year.metadata:2024');
  assert.equal(getYearDisplay({}, t).label, 'card.year.unknown');
});
