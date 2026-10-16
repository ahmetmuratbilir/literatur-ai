import test from 'node:test';
import assert from 'node:assert/strict';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

// Sahte saglayici: uretim ve dogrulama cagrilari sirayla cevaplanir.
process.env.AI_PROVIDERS = 'deepseek';
process.env.DEEPSEEK_API_KEY = 'test-key';
delete process.env.GROQ_API_KEY;

const { generateCitedSentence } = await import('../services/citedSentence.js');

const previousDispatcher = getGlobalDispatcher();
const agent = new MockAgent();
agent.disableNetConnect();
setGlobalDispatcher(agent);
const deepseek = agent.get('https://api.deepseek.com');
test.after(async () => {
  // Kurulan her cevap gercekten istendi: cagri sayisi beklenenden az degil.
  agent.assertNoPendingInterceptors();
  await agent.close();
  setGlobalDispatcher(previousDispatcher);
});

const PASSAGE = 'Passive decay heat removal was maintained for 72 hours without AC power in the integral test facility, and the natural circulation loop sustained core cooling.';
const GOOD = 'Entegre test tesisinde pasif artik isi uzaklastirma, AC gucu olmadan 72 saat boyunca surdurulmustur.';

/** Siradaki model cevabini kurar. */
const reply = (obj) => deepseek
  .intercept({ path: '/chat/completions', method: 'POST' })
  .reply(200, { choices: [{ message: { content: typeof obj === 'string' ? obj : JSON.stringify(obj) } }] });
const sentence = (text) => ({ sentence: text, hedge_level: 'strong', refused: false, refusal_reason: '' });
const verdict = (label, span) => ({ label, quoted_span: span, scope_gap: '', reason: 'test' });

test('ilk turda destekleniyor ve parca birebir: iki cagri, karar kesin', async () => {
  reply(sentence(GOOD));
  reply(verdict('supports', 'Passive decay heat removal was maintained for 72 hours without AC power'));
  const out = await generateCitedSentence({ passage: PASSAGE });
  assert.equal(out.refused, false);
  assert.equal(out.sentence, GOOD);
  assert.equal(out.support.label, 'supports');
  assert.equal(out.support.spanVerified, true);
  assert.equal(out.settled, true);
  assert.equal(out.calls, 2);
  assert.equal(out.mode, 'first');
});

test('pasajda olmayan sayi dogrulamaya bile gitmeden elenir, ikinci tur gecer', async () => {
  reply(sentence('Pasif isi uzaklastirma AC gucu olmadan 96 saat surdurulmustur.'));
  reply(sentence(GOOD));
  reply(verdict('supports', 'maintained for 72 hours without AC power'));
  const out = await generateCitedSentence({ passage: PASSAGE });
  assert.equal(out.sentence, GOOD);
  assert.equal(out.rounds, 2);
  assert.equal(out.calls, 3);
});

test('tavanda: pasajda bulunamayan "destekliyor" yerine birebir dogrulanmis "kismen" gosterilir', async () => {
  reply(sentence(GOOD));
  reply(verdict('supports', 'heat removal lasted seventy two hours'));
  reply(sentence('Dogal dolasim devresi cekirdek sogutmasini her kosulda guvence altina almaktadir.'));
  reply(verdict('partial', 'the natural circulation loop sustained core cooling'));
  const out = await generateCitedSentence({ passage: PASSAGE });
  assert.equal(out.refused, false);
  assert.equal(out.settled, false);
  assert.equal(out.support.label, 'partial');
  assert.equal(out.support.spanVerified, true);
  assert.equal(out.calls, 4);
});

test('yenisi istendi, pasajda baska bulgu yok: model reddeder, yeniden sorulmaz', async () => {
  reply({ sentence: '', hedge_level: '', refused: true, refusal_reason: 'no_other_point' });
  const out = await generateCitedSentence({ passage: PASSAGE, mode: 'new', previous: [GOOD] });
  assert.deepEqual(out, { refused: true, reason: 'no_other_point', calls: 1 });
});

test('yenisi iki turda da oncekinin tekrari: reddedilir, dogrulamaya gidilmez', async () => {
  reply(sentence('Entegre test tesisinde pasif artik isi uzaklastirma AC gucu olmadan 72 saat surdurulmustur.'));
  reply(sentence('Entegre tesiste pasif artik isi uzaklastirma, AC gucu olmadan 72 saat boyunca surdurulmustur.'));
  const out = await generateCitedSentence({ passage: PASSAGE, mode: 'new', previous: [GOOD] });
  assert.deepEqual(out, { refused: true, reason: 'too_similar', calls: 2 });
});

test('dogrulama semaya uymazsa "destekliyor" sayilmaz; cumle karar yok diye doner', async () => {
  reply(sentence(GOOD));
  reply({ label: 'kesinlikle-dogru', quoted_span: 'x' });
  reply(sentence(GOOD));
  reply('json degil');
  const out = await generateCitedSentence({ passage: PASSAGE });
  assert.equal(out.refused, false);
  assert.equal(out.support, null);
  assert.equal(out.settled, false);
  assert.equal(out.calls, 4);
});

// --- "Benzeri": yalniz onceki cumlenin dayandigi parcadan ---

const TWO = `${PASSAGE} However, flow instabilities were observed at pressures below 1 MPa, which reduced heat transfer efficiency by approximately 15 percent.`;
const FOCUS = 'Passive decay heat removal was maintained for 72 hours without AC power';
const bodyOf = (b) => JSON.parse(typeof b === 'string' ? b : Buffer.from(b).toString('utf8'));

test('benzeri odak parcasiyla istenir: model ikinci bulguyu hic gormez', async () => {
  deepseek.intercept({
    path: '/chat/completions',
    method: 'POST',
    body: (b) => {
      const user = bodyOf(b).messages[1].content;
      return user.includes(FOCUS) && !user.includes('flow instabilities') && user.includes('İSTEK: BENZER');
    },
  }).reply(200, { choices: [{ message: { content: JSON.stringify(sentence('AC gucu olmadan pasif artik isi uzaklastirma 72 saat surmustur.')) } }] });
  reply(verdict('supports', 'maintained for 72 hours without AC power'));
  const out = await generateCitedSentence({ passage: TWO, mode: 'similar', previous: [GOOD], focus: FOCUS });
  assert.equal(out.refused, false);
  assert.equal(out.focused, true);
  assert.equal(out.settled, true);
});

test('pasajda olmayan odak parcasi yok sayilir; yedek kural yeni sayiyi yakalar', async () => {
  // Istemciden gelen uydurma odak: tam pasaj kullanilir ve "benzeri" yeni sayi ekleyemez.
  reply(sentence('Dusuk basincta akis kararsizliklari verimi yaklasik yuzde 15 dusurmustur.'));
  reply(sentence('1 MPa altinda kararsizlik gozlenmistir.'));
  const out = await generateCitedSentence({ passage: TWO, mode: 'similar', previous: [GOOD], focus: 'uydurma bir odak parcasi buraya' });
  assert.deepEqual(out, { refused: true, reason: 'drifted', calls: 2 });
});
