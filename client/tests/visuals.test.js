import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { matchSpan } from '../src/visuals/match.js';
import { structureFromRules } from '../src/visuals/rules.js';
import { validate } from '../src/visuals/validate.js';
import { fitTemplates } from '../src/visuals/fit.js';
import { checkSource, paragraphHash, sealSource } from '../src/visuals/source.js';
import { profileOf, sentenceSignals } from '../src/visuals/signals.js';
import { VISUAL_SCHEMA_VERSION, addEdge, addNode, createStructure, labelOf, occurrenceAt } from '../src/visuals/schema.js';

/**
 * WO-016 görsel yapı çekirdeği.
 * Faz 1: ara yapı, sinyal sözlüğü (TR + EN), Türkçe ek toleranslı eşleştirme.
 */

// ---------- eşleştirme ----------

/** Aday cümlede bulunmalı ve dönen konum cümledeki ASIL biçimi göstermeli. */
function expectMatch(sentence, candidate, surface, mode, lang = 'tr') {
  const m = matchSpan(sentence, candidate, lang);
  assert.ok(m, `${candidate} → ${surface} bulunamadı`);
  assert.equal(sentence.slice(m.start, m.end), surface, `${candidate} yanlış yere bağlandı`);
  if (mode) assert.equal(m.mode, mode, `${candidate}: kip`);
}

test('eşleştirme: ünsüz yumuşaması (p/t/k → b/d/g; ç/c fold ile)', () => {
  expectMatch('Bu kitabı okudum.', 'kitap', 'kitabı', 'tolerant');
  expectMatch('Bahçedeki ağacı kestiler.', 'ağaç', 'ağacı', 'tolerant');
  expectMatch('Duvarın rengi soldu.', 'renk', 'rengi', 'tolerant');
  expectMatch('Kuşun kanadı kırıldı.', 'kanat', 'kanadı', 'tolerant');
});

test('eşleştirme: önek (aday ≥ 4 harf)', () => {
  expectMatch('Kararsızlığın etkisi büyüktür.', 'etki', 'etkisi', 'tolerant');
  expectMatch('Bu etkeni ayrıca inceledik.', 'etken', 'etkeni', 'tolerant');
  expectMatch('Akışın nedenleri çoktur.', 'neden', 'nedenleri', 'tolerant');
  expectMatch('Bu yöntemin sınırları var.', 'yöntem', 'yöntemin', 'tolerant');
});

test('eşleştirme: ünlü düşmesi', () => {
  expectMatch('Yazarın fikri değişti.', 'fikir', 'fikri', 'tolerant');
  expectMatch('Onun aklı karıştı.', 'akıl', 'aklı', 'tolerant');
  expectMatch('Değişkenin ismi uzundur.', 'isim', 'ismi', 'tolerant');
  expectMatch('Mahkemenin hükmü açıklandı.', 'hüküm', 'hükmü', 'tolerant');
  expectMatch('Bu şehri yeniden kurdular.', 'şehir', 'şehri', 'tolerant');
});

test('eşleştirme: ikizleşme', () => {
  expectMatch('Katılımcının hakkı korunur.', 'hak', 'hakkı', 'tolerant');
  expectMatch('Güven hissi azaldı.', 'his', 'hissi', 'tolerant');
  expectMatch('Bu zannı doğrulamadık.', 'zan', 'zannı', 'tolerant');
});

test('eşleştirme: birleşik kurallar (en fazla iki)', () => {
  expectMatch('Verinin kaybı ölçüldü.', 'kayıp', 'kaybı', 'tolerant');
  expectMatch('Hastanın kaydı silindi.', 'kayıt', 'kaydı', 'tolerant');
  expectMatch('Modern tıbbı eleştirdi.', 'tıp', 'tıbbı', 'tolerant');
  expectMatch('Başvurunun reddi bekleniyordu.', 'ret', 'reddi', 'tolerant');
});

test('eşleştirme: kısa kök yalnız kapalı ek listesiyle', () => {
  expectMatch('Bitkinin suyu azaldı.', 'su', 'suyu', 'tolerant');
  expectMatch('Bölgenin göçü sürdü.', 'göç', 'göçü', 'tolerant');
  expectMatch('Hastanın kanı alındı.', 'kan', 'kanı', 'tolerant');
  expectMatch('Bu ağı genişlettik.', 'ağ', 'ağı', 'tolerant');
});

test('eşleştirme: olumsuz örnekler eşleşmez', () => {
  assert.equal(matchSpan('Ölçüm için araç kullanıldı.', 'ara'), null);
  assert.equal(matchSpan('Projeye katkı sağladı.', 'kat'), null);
  assert.equal(matchSpan('Bu konunun önemi büyük.', 'ön'), null);
});

test('eşleştirme: belgelenmiş belirsizlikler tolerant olarak işaretli kalır', () => {
  // Önek kuralı anlam farkını görmez; arayüz tolerant öğeyi işaretleyebilsin diye kip korunur.
  expectMatch('Parçacık etkileşimi ölçüldü.', 'etki', 'etkileşimi', 'tolerant');
  // "art + ı" da geçerli Türkçe.
  expectMatch('Bunun artı yanı var.', 'art', 'artı', 'tolerant');
});

test('eşleştirme: büyük/küçük harf ve İ/ı (fold)', () => {
  expectMatch('İnsan davranışı karmaşıktır.', 'insan', 'İnsan', 'fold');
  expectMatch('ISIL denge sağlandı.', 'ısıl', 'ISIL', 'fold');
});

test('eşleştirme: birebir ve kelime sınırı', () => {
  expectMatch('Akış kararsızlığı birkaç etkene bağlıdır.', 'akış kararsızlığı', 'Akış kararsızlığı', 'fold');
  expectMatch('Düşük güç kaldırma kuvvetini zayıflatır.', 'kaldırma kuvvetini', 'kaldırma kuvvetini', 'exact');
  // "kan" önce gelen "kanat"ın içine bağlanmamalı.
  expectMatch('Kanat yırtıldı ve kan aktı.', 'kan', 'kan', 'exact');
});

test('eşleştirme: çok kelimeli aday, bitişik ve sıralı', () => {
  expectMatch('Isınan soğutucu doğal sirkülasyonla yukarı taşınır.', 'doğal sirkülasyon', 'doğal sirkülasyonla', 'tolerant');
  assert.equal(matchSpan('Doğal bir süreçte sirkülasyon başlar.', 'doğal sirkülasyon'), null, 'bitişik olmayan kelimeler');
});

test('eşleştirme: İngilizce', () => {
  expectMatch('Low power causes oscillations.', 'cause', 'causes', 'tolerant', 'en');
  expectMatch('The load increased sharply.', 'increase', 'increased', 'tolerant', 'en');
  expectMatch('Flow depends on geometry.', 'flow', 'Flow', 'fold', 'en');
  assert.equal(matchSpan('The cat sat.', 'dog', 'en'), null);
});

// ---------- sinyaller ----------

const sig = (text, lang) => sentenceSignals(text, lang);

test('sinyal: sıra (TR olumlu/olumsuz, madde işareti)', () => {
  assert.equal(sig('Ardından örnekler kurutuldu.').order, 1);
  assert.equal(sig('Yöntem üç aşamadan oluşur.').order, 1);
  assert.equal(sig('2) Numuneler tartıldı.').order, 1);
  assert.equal(sig('Sonuçlar tabloda verilmiştir.').order, 0);
});

test('sinyal: döngü, neden, yön (TR)', () => {
  assert.equal(sig('Soğuyan su çekirdeğe geri döner.').cycle, 1);
  assert.equal(sig('Akış kararsızlığı birkaç etkene bağlıdır.').cause, 1);
  assert.equal(sig('Düşük güç kaldırma kuvvetini zayıflatır.').direction, 1);
  assert.equal(sig('Model tek boyutludur.').cause, 0);
  assert.equal(sig('Model tek boyutludur.').direction, 0);
});

test('sinyal: "ise" yalnız -ken ile kurulmuşsa karşıtlık', () => {
  assert.equal(sig('A artarken B ise azalır.').contrast, 1);
  assert.equal(sig('Sonuç ise anlamlıdır.').contrast, 0);
  assert.equal(sig('Ancak bu sistemlerin davranışı sınırlı doğrulanmıştır.').contrast, 1);
});

test('sinyal: sınıflama, zaman, sayı, atıf (TR)', () => {
  assert.equal(sig('Reaktörler üç gruba ayrılır.').classify, 1);
  assert.equal(sig('Kuramın iki türleri vardır.').classify, 1);
  assert.equal(sig('1979 ve 1986 kazaları dönüm noktasıdır.').time, 2);
  assert.equal(sig('Verim %42 ve %35 ölçüldü.').number, 2);
  assert.equal(sig('Bu sonuç doğrulanmıştır (Yılmaz, 2021).').citation, 1);
  assert.equal(sig('Bu sonuç doğrulanmıştır.').citation, 0);
});

test('sinyal: İngilizce aynı kategoriler', () => {
  const en = (t) => sentenceSignals(t, 'en');
  assert.equal(en('First, samples were dried.').order, 1);
  assert.equal(en('The water returns to the core.').cycle, 1);
  assert.equal(en('Instability depends on power.').cause, 1);
  assert.equal(en('Low power weakens buoyancy.').direction, 1);
  assert.equal(en('However, data are limited.').contrast, 1);
  assert.equal(en('Reactors are divided into three groups.').classify, 1);
  assert.equal(en('The results are shown in the table.').cause, 0);
  assert.equal(en('The results are shown in the table.').contrast, 0);
});

test('profil: paragraf toplamı', () => {
  const s = createStructure({ text: 'İlk olarak su ısıtılır. Ardından buhar yükselir. Son olarak buhar yoğuşur ve geri döner.' });
  const p = profileOf(s.sentences, 'tr');
  assert.equal(p.order, 3);
  assert.equal(p.cycle, 1);
});

// ---------- ara yapı ----------

test('yapı: sürüm, kaynak kopyası, etiket metni ve geçiş sırası', () => {
  const s = createStructure({ text: 'Isı ısıyı taşır ve ısı yükselir. İkinci cümle.', paragraphKey: 'p1' });
  assert.equal(s.schema, VISUAL_SCHEMA_VERSION);
  assert.equal(s.source.text, 'Isı ısıyı taşır ve ısı yükselir. İkinci cümle.');
  assert.equal(s.sentences.length, 2);
  const t = s.sentences[0].text;
  // Küçük "ısı" dizgisi önce "ısıyı"nın içinde (0), sonra ayrı kelime olarak (1)
  // geçer; baştaki "Isı" büyük I ile başladığı için sayılmaz.
  const at = t.indexOf(' ısı ') + 1;
  const n = addNode(s, { sentence: 0, start: at, end: at + 3 });
  assert.equal(n.text, 'ısı');
  assert.equal(n.occurrence, 1);
  assert.equal(occurrenceAt('a b a b a', 'a', 4), 1, 'sıfırdan sayılır: 0, 4, 8');
  assert.equal(occurrenceAt('a b a b a', 'a', 8), 2);
  assert.equal(occurrenceAt('a b a', 'a', 1), null, 'konumda o metin yoksa null');
});

test('yapı: etiketsiz kenar, sınır dışı konum reddedilir, labelOf yalnız yapıdan', () => {
  const s = createStructure({ text: 'Düşük güç kaldırma kuvvetini zayıflatır.' });
  const a = addNode(s, { sentence: 0, start: 0, end: 9 });
  const b = addNode(s, { sentence: 0, start: 10, end: 28 });
  assert.equal(b.text, 'kaldırma kuvvetini');
  const e = addEdge(s, { from: a.id, to: b.id, sentence: 0 });
  assert.equal(e.text, null);
  assert.equal(addNode(s, { sentence: 0, start: 5, end: 999 }), null);
  assert.equal(addNode(s, { sentence: 3, start: 0, end: 2 }), null);
  assert.equal(labelOf(a), 'Düşük güç');
  a.userText = 'Düşük güç (%8 altı)';
  assert.equal(labelOf(a), 'Düşük güç (%8 altı)');
});

// ---------- Faz 2: kural kademesi ----------

const FIXTURES = JSON.parse(readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'visuals-paragraphs.json'), 'utf8',
)).paragraphs;

for (const fx of FIXTURES) {
  test(`kural kademesi: ${fx.id} → ${fx.rule ?? 'kalıp yok'}`, () => {
    const { structure: st, rule, reason } = structureFromRules({ text: fx.text, lang: fx.lang });
    assert.equal(rule, fx.rule, `kural (${fx.id})`);
    if (fx.rule === null) {
      assert.equal(reason, 'rules.none');
      assert.equal(st.nodes.length, 0, 'kalıp yoksa boş şema üretilmez');
      return;
    }
    assert.deepEqual(st.nodes.map((n) => n.text), fx.nodes, `düğümler (${fx.id})`);
    // Her düğüm cümleden birebir: kopya metin, konumdaki parçaya eşit.
    for (const n of st.nodes) assert.equal(st.sentences[n.sentence].text.slice(n.start, n.end), n.text);
    const idx = (id) => st.nodes.findIndex((n) => n.id === id);
    assert.deepEqual(st.edges.map((e) => [idx(e.from), idx(e.to), e.text]), fx.edges, `kenarlar (${fx.id})`);
    if (fx.roles) assert.deepEqual(st.nodes.map((n) => n.role), fx.roles);
    if (fx.citations) assert.deepEqual(st.nodes.map((n) => n.citations), fx.citations);
    if (fx.years) assert.deepEqual(st.nodes.map((n) => n.value.year), fx.years);
    if (fx.values) {
      assert.deepEqual(st.nodes.map((n) => n.value.number), fx.values);
      assert.ok(st.nodes.every((n) => n.value.unit === fx.unit));
    }
    // Kural kademesinin çıktısı doğrulamadan değişmeden geçer.
    const v = validate(st);
    assert.equal(v.nodes.length, st.nodes.length);
    assert.equal(v.edges.length, st.edges.length);
    assert.deepEqual(v.dropped, []);
  });
}

test('kural kademesi: her kalıpta en az 2 Türkçe ve 1 İngilizce fikstür', () => {
  for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6']) {
    assert.ok(FIXTURES.filter((f) => f.rule === r && f.lang === 'tr').length >= 2, `${r} tr`);
    assert.ok(FIXTURES.filter((f) => f.rule === r && f.lang === 'en').length >= 1, `${r} en`);
  }
  assert.ok(FIXTURES.filter((f) => f.rule === null).length >= 3);
});

test('sinyal: "42%" biçimindeki yüzde de sayılır', () => {
  assert.equal(sentenceSignals('Efficiency was 42%, losses were 35%.', 'en').number, 2);
});

// ---------- Faz 2: doğrulama ----------

test('doğrulama: sarkan kenar, yinelenen düğüm, cümle dışı konum atılır ve sayılır', () => {
  const { structure: st } = structureFromRules({ text: FIXTURES.find((f) => f.id === 'r3-tr-1').text, lang: 'tr' });
  const broken = {
    ...st,
    nodes: [...st.nodes, { ...st.nodes[1], id: 'nDup' }, { id: 'nBad', sentence: 0, start: 0, end: 4, text: 'yanlış' }],
    edges: [...st.edges, { id: 'eDang', from: 'nYok', to: st.nodes[0].id, sentence: 0, start: null, end: null, text: null, polarity: null }],
  };
  const v = validate(broken);
  assert.equal(v.nodes.length, st.nodes.length);
  const reasons = v.dropped.map((d) => d.reason).sort();
  assert.deepEqual(reasons, ['dangling', 'duplicate', 'not_in_sentence']);
});

test('doğrulama: dayanaksız kutup işareti silinir, dayanaklı kalır', () => {
  const { structure: st } = structureFromRules({ text: FIXTURES.find((f) => f.id === 'r3-tr-1').text, lang: 'tr' });
  const withPol = { ...st, edges: st.edges.map((e) => ({ ...e, polarity: '+' })) };
  const v = validate(withPol);
  assert.ok(v.edges.every((e) => e.polarity === null), '"nedenleri şunlardır" cümlesinde yön fiili yok');
  assert.ok(v.dropped.some((d) => d.reason === 'unsupported_polarity'));

  const s2 = createStructure({ text: 'Düşük güç kaldırma kuvvetini zayıflatır.' });
  const a = addNode(s2, { sentence: 0, start: 0, end: 9 });
  const b = addNode(s2, { sentence: 0, start: 10, end: 28 });
  addEdge(s2, { from: a.id, to: b.id, sentence: 0, start: 29, end: 39, polarity: '-' });
  assert.equal(validate(s2).edges[0].polarity, '-');
});

test('doğrulama: model gibi yalnız metinle gelen öğe cümledeki asıl biçime bağlanır', () => {
  const st = createStructure({ text: 'Akışın nedenleri ve yöntemin sınırları tartışıldı.' });
  st.nodes.push({ id: 'm1', sentence: 0, start: null, end: null, text: 'neden', origin: 'model' });
  st.nodes.push({ id: 'm2', sentence: 0, start: null, end: null, text: 'yöntem', origin: 'model' });
  st.nodes.push({ id: 'm3', sentence: 0, start: null, end: null, text: 'uydurma kavram', origin: 'model' });
  const v = validate(st);
  assert.deepEqual(v.nodes.map((n) => n.text), ['nedenleri', 'yöntemin']);
  assert.ok(v.nodes.every((n) => n.matchMode === 'tolerant'));
  assert.deepEqual(v.dropped, [{ kind: 'node', reason: 'not_in_sentence', detail: 'uydurma kavram' }]);
});

// ---------- Faz 3: şablon uygunluğu ----------

/** Prototipteki elle yazılmış grafları yapıya çevirir: etiketin yeri matchSpan ile bulunur. */
function protoStructure(text, nodes, edges) {
  const st = createStructure({ text });
  st.profile = profileOf(st.sentences, 'tr');
  const ids = nodes.map(([label, s]) => {
    const m = matchSpan(st.sentences[s].text, label);
    assert.ok(m, `prototip etiketi cümlede yok: ${label}`);
    return addNode(st, { sentence: s, start: m.start, end: m.end }).id;
  });
  for (const [a, b, label, s] of edges) {
    const m = matchSpan(st.sentences[s].text, label);
    assert.ok(m, `prototip ok etiketi cümlede yok: ${label}`);
    addEdge(st, { from: ids[a], to: ids[b], sentence: s, start: m.start, end: m.end });
  }
  return st;
}

const PROTO_TEMPLATES = ['akis', 'dongu', 'kavram', 'hiyerarsi', 'balik', 'geri', 'arguman', 'karsi', 'zaman'];
const fitSummary = (st) => {
  const rows = fitTemplates(st).filter((r) => PROTO_TEMPLATES.includes(r.template));
  return { ok: rows.filter((r) => r.ok).map((r) => r.template).sort(), rec: rows.find((r) => r.recommended)?.template };
};

const PROTO_COOL = 'Reaktör çekirdeğinde üretilen bozunma ısısı, birincil soğutucuyu ısıtarak yoğunluğunu düşürür. Isınan soğutucu, pompa gerekmeden yükselen kolda doğal sirkülasyonla yukarı taşınır. Üst bölgedeki ısı değiştirici, ısıyı pasif soğutma havuzuna aktarır. Soğuyan ve yoğunluğu artan su, alçalan koldan çekirdeğe geri döner ve döngü tamamlanır.';
const PROTO_FAC = 'Doğal sirkülasyon döngülerinde akış kararsızlığı birkaç etkene bağlıdır. Düşük güç seviyesi kaldırma kuvvetini zayıflatır. Yükselen koldaki iki fazlı akış basınç düşüşünü dalgalandırır. Boru geometrisi ve yerel kayıplar sönümlemeyi azaltır. Isı değiştiricideki soğutma koşulları ise dönüş sıcaklığını değiştirir.';

test('uygunluk: prototipteki döngü paragrafı — prototipin kararıyla aynı', () => {
  const st = protoStructure(PROTO_COOL,
    [['bozunma ısısı', 0], ['doğal sirkülasyon', 1], ['ısı değiştirici', 2], ['yoğunluğu artan su', 3]],
    [[0, 1, 'birincil soğutucuyu ısıtarak', 0], [1, 2, 'yukarı taşınır', 1], [2, 3, 'havuzuna aktarır', 2], [3, 0, 'çekirdeğe geri döner', 3]]);
  assert.deepEqual(fitSummary(st), { ok: ['akis', 'dongu', 'kavram'], rec: 'dongu' });
  const geri = fitTemplates(st).find((r) => r.template === 'geri');
  assert.equal(geri.reason, 'unfit.noPolarityOrCycle', 'kutup işareti metinde yok');
});

test('uygunluk: prototipteki etkenler paragrafı — prototipin kararıyla aynı', () => {
  const st = protoStructure(PROTO_FAC,
    [['akış kararsızlığı', 0], ['düşük güç seviyesi', 1], ['iki fazlı akış', 2], ['boru geometrisi ve yerel kayıplar', 3], ['soğutma koşulları', 4]],
    [[1, 0, 'kaldırma kuvvetini zayıflatır', 1], [2, 0, 'basınç düşüşünü dalgalandırır', 2], [3, 0, 'sönümlemeyi azaltır', 3], [4, 0, 'dönüş sıcaklığını değiştirir', 4]]);
  assert.deepEqual(fitSummary(st), { ok: ['balik', 'hiyerarsi', 'kavram'], rec: 'balik' });
});

test('uygunluk: prototipteki argüman paragrafı (R5 ile koddan) — prototipin kararıyla aynı', () => {
  const fx = FIXTURES.find((f) => f.id === 'r5-tr-1');
  const { structure } = structureFromRules({ text: fx.text, lang: 'tr' });
  assert.deepEqual(fitSummary(structure), { ok: ['arguman'], rec: 'arguman' });
});

test('uygunluk: her kalıbın önerilen şablonu', () => {
  const expected = {
    'r1-tr-1': 'akis', 'r1-tr-2': 'hiyerarsi', 'r1-en-1': 'akis',
    'r2-tr-1': 'akis', 'r2-tr-2': 'akis', 'r2-en-1': 'akis',
    'r3-tr-1': 'balik', 'r3-tr-2': 'balik', 'r3-en-1': 'balik',
    'r4-tr-1': 'zaman', 'r4-tr-2': 'zaman', 'r4-en-1': 'zaman',
    'r5-tr-1': 'arguman', 'r5-tr-2': 'arguman', 'r5-en-1': 'arguman',
    'r6-tr-1': 'pasta', 'r6-tr-2': 'cubuk', 'r6-en-1': 'pasta',
  };
  for (const [id, rec] of Object.entries(expected)) {
    const fx = FIXTURES.find((f) => f.id === id);
    const { structure } = structureFromRules({ text: fx.text, lang: fx.lang });
    assert.equal(fitTemplates(structure).find((r) => r.recommended)?.template, rec, id);
  }
});

test('uygunluk: karşılaştırma ve dörtlü kural kademesinde her zaman "model gerekir"', () => {
  for (const fx of FIXTURES.filter((f) => f.rule)) {
    const { structure } = structureFromRules({ text: fx.text, lang: fx.lang });
    const rows = fitTemplates(structure);
    for (const t of ['karsi', 'dortlu']) assert.equal(rows.find((r) => r.template === t).reason, 'unfit.needsModel');
  }
});

test('uygunluk: yüzde toplamı 100 değilse pasta uymaz, çubuk uyar', () => {
  const { structure } = structureFromRules({ text: 'Birinci grupta %40, ikinci grupta %30 ölçüldü.', lang: 'tr' });
  const rows = fitTemplates(structure);
  assert.equal(rows.find((r) => r.template === 'pasta').ok, false);
  assert.equal(rows.find((r) => r.template === 'cubuk').ok, true);
});

// ---------- Faz 3: kaynak değişimi ----------

const BASE = 'Isınan soğutucu yükselen kolda taşınır. Isı değiştirici ısıyı havuza aktarır.';

async function sealedBase() {
  const st = createStructure({ text: BASE, paragraphKey: 'p-test' });
  const s0 = st.sentences[0].text;
  const s1 = st.sentences[1].text;
  addNode(st, { sentence: 0, start: s0.indexOf('yükselen kolda'), end: s0.indexOf('yükselen kolda') + 'yükselen kolda'.length });
  addNode(st, { sentence: 1, start: s1.indexOf('ısıyı havuza'), end: s1.indexOf('ısıyı havuza') + 'ısıyı havuza'.length });
  return sealSource(st);
}

/** Güncellenmiş yapıda her etiket hâlâ cümlesindeki aynı metni göstermeli. */
function assertAnchored(st) {
  for (const n of st.nodes) assert.equal(st.sentences[n.sentence].text.slice(n.start, n.end), n.text, n.id);
}

test('kaynak: hash SHA-256, yalnız boşluk farkı aynı hash', async () => {
  const h = await paragraphHash(BASE);
  assert.match(h, /^sha256:[0-9a-f]{64}$/);
  assert.equal(await paragraphHash('  Isınan  soğutucu yükselen kolda taşınır.\nIsı değiştirici ısıyı havuza aktarır. '), h);
  assert.notEqual(await paragraphHash(BASE + ' Ek.'), h);
});

test('kaynak: metin değişmedi → unchanged', async () => {
  const st = await sealedBase();
  const r = await checkSource(st, BASE);
  assert.equal(r.status, 'unchanged');
  assert.equal(r.warn, false);
});

test('kaynak: yalnız boşluk değişti → unchanged, konumlar yine doğru', async () => {
  const st = await sealedBase();
  const r = await checkSource(st, 'Isınan  soğutucu yükselen kolda taşınır.  Isı değiştirici ısıyı havuza aktarır.');
  assert.equal(r.status, 'unchanged');
  assertAnchored(r.structure);
});

test('kaynak: paragrafa kelime eklendi, etiketlerin dışına → relocated, yeni konumlar doğru', async () => {
  const st = await sealedBase();
  const r = await checkSource(st, 'Isınan soğutucu hızla yükselen kolda taşınır. Isı değiştirici ısıyı havuza aktarır.');
  assert.equal(r.status, 'relocated');
  assert.equal(r.warn, false);
  assertAnchored(r.structure);
  assert.equal(r.structure.nodes[0].start, st.nodes[0].start + 'hızla '.length);
  assert.equal(r.structure.source.text.includes('hızla'), true, 'kaynak yeni metne güncellenir');
});

test('kaynak: bir etiketin içine kelime eklendi → changed, kaybolan etiket listede, şekil metni aynı', async () => {
  const st = await sealedBase();
  const r = await checkSource(st, 'Isınan soğutucu yükselen sıcak kolda taşınır. Isı değiştirici ısıyı havuza aktarır.');
  assert.equal(r.status, 'changed');
  assert.equal(r.warn, true);
  assert.deepEqual(r.lost.map((l) => l.text), ['yükselen kolda']);
  assert.equal(labelOf(r.structure.nodes[0]), 'yükselen kolda', 'şekil saklanan metinle çizilmeye devam eder');
});

test('kaynak: paragraf silindi → missing, etiketler yapıdan okunur', async () => {
  const st = await sealedBase();
  const r = await checkSource(st, null);
  assert.equal(r.status, 'missing');
  assert.equal(r.warn, true);
  assert.deepEqual(r.structure.nodes.map(labelOf), ['yükselen kolda', 'ısıyı havuza']);
});

test('kaynak: "olduğu gibi bırak" (detached) → uyarı yok', async () => {
  const st = await sealedBase();
  const detached = { ...st, source: { ...st.source, detached: true } };
  const r = await checkSource(detached, 'tamamen başka bir metin');
  assert.equal(r.status, 'detached');
  assert.equal(r.warn, false);
});

test('kaynak: cümle sırası değişti → changed (yanlış cümleye bağlamaktansa uyar)', async () => {
  const st = await sealedBase();
  const r = await checkSource(st, 'Isı değiştirici ısıyı havuza aktarır. Isınan soğutucu yükselen kolda taşınır.');
  assert.equal(r.status, 'changed');
});

test('kaynak: geçiş sırası — aynı kelime iki kez, ikincisi etiketli', async () => {
  const text = 'Sonra ısı artar ve ısı yayılır.';
  const st0 = createStructure({ text });
  const at = text.indexOf('ısı', text.indexOf('ısı') + 1);
  addNode(st0, { sentence: 0, start: at, end: at + 3 });
  assert.equal(st0.nodes[0].occurrence, 1);
  const st = await sealSource(st0);

  const after = await checkSource(st, 'Sonra ısı artar ve ısı yayılır ve ısı kaybolur.');
  assert.equal(after.status, 'relocated', 'etiketten sonra eklenen geçiş');
  assert.equal(after.structure.nodes[0].start, at);
  assert.equal(after.structure.nodes[0].occurrence, 1);

  const before = await checkSource(st, 'Önce ısı, sonra ısı artar ve ısı yayılır.');
  assert.equal(before.status, 'relocated', 'etiketten önce eklenen geçiş: değişen bölge etiketin önünde');
  assertAnchored(before.structure);
  assert.equal(before.structure.nodes[0].occurrence, 2, 'artık üçüncü geçiş; aynı kelime');
  assert.ok(before.structure.sentences[0].text.slice(before.structure.nodes[0].start).startsWith('ısı yayılır'));

  const changed = await checkSource(st, 'Sonra ısı artar ve su yayılır.');
  assert.equal(changed.status, 'changed', 'etiketli geçiş değişti; öbür "ısı"ya sessizce bağlanmaz');
});
