import test from 'node:test';
import assert from 'node:assert/strict';

import { recordSearch, getZeroStreaks, resetZeroStreaks, STREAK_THRESHOLD } from '../services/sourceZeroTracker.js';

const silence = (fn) => {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try { return fn(); } finally { console.log = log; console.error = error; }
};

test('esige kadar alarm yok, esikte TEK alarm', () => {
  resetZeroStreaks();
  const alerts = [];
  silence(() => {
    for (let i = 0; i < STREAK_THRESHOLD + 3; i++) {
      alerts.push(...recordSearch({ doaj: 0, openalex: 10 }, { zeroSources: ['doaj'] }));
    }
  });
  assert.equal(alerts.length, 1, 'alarm her aramada tekrarlanmamali');
  assert.equal(alerts[0].source, 'doaj');
  assert.equal(alerts[0].count, STREAK_THRESHOLD);
});

test('kaynak sonuc dondurunce seri sifirlanir', () => {
  resetZeroStreaks();
  silence(() => {
    recordSearch({ doaj: 0 }, { zeroSources: ['doaj'] });
    recordSearch({ doaj: 0 }, { zeroSources: ['doaj'] });
    recordSearch({ doaj: 12 }, { zeroSources: [] });
  });
  assert.deepEqual(getZeroStreaks(), []);
});

test('hata veren veya kapali kaynak seriye yazilmaz (onlar failedSources ta)', () => {
  resetZeroStreaks();
  silence(() => {
    for (let i = 0; i < STREAK_THRESHOLD + 1; i++) {
      // scopus: kapali; core: 401 veriyor. Ikisi de 0 cekti ama "sessiz sifir" degil.
      recordSearch({ scopus: 0, core: 0, doaj: 5 }, { zeroSources: [] });
    }
  });
  assert.deepEqual(getZeroStreaks(), []);
});

test('toparlanma loglanir', () => {
  resetZeroStreaks();
  const logs = [];
  const { log, error } = console;
  console.error = () => {};
  console.log = (m) => logs.push(m);
  try {
    for (let i = 0; i < STREAK_THRESHOLD; i++) recordSearch({ arxiv: 0 }, { zeroSources: ['arxiv'] });
    recordSearch({ arxiv: 4 }, { zeroSources: [] });
  } finally {
    console.log = log;
    console.error = error;
  }
  assert.ok(logs.some((m) => String(m).includes('SOURCE_ZERO_RECOVERED')));
});
