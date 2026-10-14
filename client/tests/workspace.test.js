import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARK, OVERRIDE, applyOverride, classifySentence, sentenceKey, splitSentences, summarize,
} from '../src/components/workspace/claimDetection.js';
import { inlineCitation, referenceLine } from '../src/components/workspace/citation.js';
import { findCitations, isReferencesHeading, matchSources } from '../src/components/workspace/references.js';
import { SUPPORT_SHAPES, isSettled, locateSpan, refusalKey, supportLabel } from '../src/components/workspace/evidence.js';
import { DEFAULT_SETUP, MARGIN_PRESETS, PAGE_SIZES, pageGeometry, pageStyle } from '../src/components/workspace/pageSetup.js';
import { TEMPLATES, templateHtml, templateWords } from '../src/components/workspace/templates.js';
import { buildOutline, countWords } from '../src/components/workspace/outline.js';

// --- Cümle sınıflandırma (tasarim-yonu.md §6, 1. kademe) ---

test('atif isareti tasiyan cumle "cited" sayilir', () => {
  for (const s of [
    'Pasif sistemler artik isiyi uzaklastirir (Yilmaz, 2023).',
    'Dogal dolasim verimi dusmektedir (Chen & Wang, 2021).',
    'Bu etki daha once gosterilmistir [14].',
    'Birden cok kaynak bunu destekler [3, 7].',
  ]) {
    assert.equal(classifySentence(s).mark, MARK.cited, s);
  }
});

test('baslik, soru, kisa cumle ve bolum gecisi iddia sayilmaz', () => {
  for (const [s, reason] of [
    // Turkce harfli ve sapkasiz yazim ayni sonucu vermeli.
    ['Bu bölümde önce pasif güvenlik sistemleri ele alınmaktadır.', 'transition'],
    ['Bu bolumde once pasif guvenlik sistemleri ele alinmaktadir.', 'transition'],
    ['Şekil 2 akışı göstermektedir.', 'transition'],
    ['Aşağıda yöntem anlatılmaktadır ve sonra bulgular gelmektedir.', 'transition'],
    ['Bu calismada uc tasarim karsilastirilmistir.', 'transition'],
    ['Ilk olarak yontem anlatilmaktadir.', 'transition'],
    ['Sekil 2 akisi gostermektedir.', 'transition'],
    ['In this section we review the literature.', 'transition'],
    ['Bu neden boyle olmaktadir?', 'question'],
    ['Giris bolumu', 'short'],
  ]) {
    const out = classifySentence(s);
    assert.equal(out.mark, MARK.notClaim, s);
    assert.equal(out.reason, reason, s);
  }
});

test('atifsiz duz iddia "uncited" kalir', () => {
  const out = classifySentence('Dusuk basincli rejimlerde dogal dolasim verimi belirgin olcude dusmektedir.');
  assert.deepEqual(out, { mark: MARK.uncited, reason: 'undetermined' });
});

test('1. kademe "iddia mi" sorusuna karar vermez, yalnizca elemeyi yapar', () => {
  // Yontem anlatan ama kalipla baslamayan cumle de "undetermined" kalir;
  // bunu ayirmak 2. kademenin isi (bugun yok).
  assert.equal(classifySentence('Ornekler rastgele secilmis ve iki gruba ayrilmistir.').reason, 'undetermined');
});

test('cumle bolme: kisaltma ve ondalik sayi cumleyi bolmuyor', () => {
  const parts = splitSentences('Sicaklik 4,2 derece dustu. Ikinci cumle burada!');
  assert.equal(parts.length, 2);
  assert.match(parts[0].text, /^Sicaklik 4,2 derece dustu\./);
});

test('cumle bolme: noktasiz son parca da sayilir', () => {
  assert.equal(splitSentences('Tek cumle noktasiz').length, 1);
  assert.equal(splitSentences('').length, 0);
});

test('ozet yuzde uretmez, sayi uretir', () => {
  const counts = summarize([
    { mark: MARK.cited }, { mark: MARK.cited },
    { mark: MARK.uncited },
    { mark: MARK.notClaim }, { mark: MARK.notClaim }, { mark: MARK.notClaim },
  ]);
  assert.deepEqual(counts, { total: 6, cited: 2, uncited: 1, notClaim: 3 });
  assert.equal(Object.keys(counts).some((k) => /percent|oran|ratio/i.test(k)), false);
});

// --- Kullanıcı düzeltmesi (§5: sınıflandırıcı yanılır, kullanıcı düzeltir) ---

test('duzeltme anahtari harf ve bosluk farkini yutar', () => {
  assert.equal(sentenceKey('  Doğal   dolaşım\nverimi düşük. '), sentenceKey('dogal dolasim verimi dusuk.'));
  assert.notEqual(sentenceKey('Verim düşük.'), sentenceKey('Verim yüksek.'));
  assert.equal(sentenceKey(null), '');
});

test('kullanici karari siniflandiriciyi ezer', () => {
  const uncited = classifySentence('Dusuk basincli rejimlerde dogal dolasim verimi belirgin olcude dusmektedir.');
  const transition = classifySentence('Bu bolumde once yontem anlatilmaktadir.');
  const cited = classifySentence('Pasif sistemler artik isiyi uzaklastirir (Yilmaz, 2023).');

  assert.deepEqual(applyOverride(uncited, OVERRIDE.notClaim), { mark: MARK.notClaim, reason: 'userNotClaim' });
  // "Iddia" denen ama atifi olmayan cumle kaynak bekler.
  assert.deepEqual(applyOverride(transition, OVERRIDE.claim), { mark: MARK.uncited, reason: 'userClaim' });
  // Atif isareti olan cumle "iddia" denince atifli kalir.
  assert.deepEqual(applyOverride(cited, OVERRIDE.claim), cited);
  // Karar yoksa siniflandirici gecerli.
  assert.deepEqual(applyOverride(uncited, undefined), uncited);
});

// --- Destek rozeti ve pasaj vurgusu ---

test('destek sinifi: yalniz birebir dogrulanmis "supports" kesin sayilir', () => {
  assert.equal(isSettled({ label: 'supports', spanVerified: true }), true);
  assert.equal(isSettled({ label: 'supports', spanVerified: false }), false);
  assert.equal(isSettled({ label: 'partial', spanVerified: true }), false);
  assert.equal(isSettled(null), false);
  // Dogrulama sonuc vermediyse rozet "kontrol yapilamadi" der, "destekliyor" demez.
  assert.equal(supportLabel(null), 'none');
  assert.equal(supportLabel({ label: 'uydurma' }), 'none');
  assert.equal(supportLabel({ label: 'contradicts' }), 'contradicts');
  assert.equal(SUPPORT_SHAPES.contradicts, '▲');
});

test('parcanin pasajdaki yeri: bosluk ve buyuk-kucuk harf farki asilir', () => {
  const passage = 'Passive decay heat removal was maintained for 72 hours\nwithout AC power.';
  const [start, end] = locateSpan(passage, 'maintained for 72 hours without ac power');
  assert.equal(passage.slice(start, end), 'maintained for 72 hours\nwithout AC power');
  assert.equal(locateSpan(passage, 'lasted 72 hours'), null);
  assert.equal(locateSpan(passage, ''), null);
  // Duzenli ifade karakteri iceren parca kirilmaz.
  assert.equal(locateSpan('cost (n = 12) rose', '(n = 12)')[0], 5);
});

test('ret sebebi kullaniciya gosterilecek metne cevriliyor', () => {
  assert.equal(refusalKey('no_other_point'), 'workspace.refusedNoOther');
  assert.equal(refusalKey('identical'), 'workspace.refusedSimilar');
  assert.equal(refusalKey('too_close'), 'workspace.refusedTooClose');
  assert.equal(refusalKey('drifted'), 'workspace.refusedDrifted');
  assert.equal(refusalKey('number_not_in_passage'), 'workspace.refusedNumber');
  assert.equal(refusalKey('citation:doi'), 'workspace.refusedCheck');
  assert.equal(refusalKey('passage_too_short'), 'workspace.refused');
  assert.equal(refusalKey(undefined), 'workspace.refused');
});

// --- Kaynakça tutarlılığı ---

test('kaynakca basligi iki dilde ve harf farkiyla taniniyor', () => {
  for (const h of ['Kaynakça', 'KAYNAKÇA', 'Kaynaklar', 'References', 'Bibliography', ' kaynakca ']) {
    assert.equal(isReferencesHeading(h), true, h);
  }
  assert.equal(isReferencesHeading('Kaynakça Taraması'), false);
  assert.equal(isReferencesHeading('Giriş'), false);
});

test('metindeki yazar-yil atiflari: parantez ici, coklu, anlati', () => {
  const found = findCitations(
    'Dolasim duser (Yılmaz vd., 2020; Chen & Wang, 2021). Demir (2019) bunu gosterdi. '
    + 'Kaya ve Arslan (2018) de oyle. Veri (Haziran 2020) toplandi, n (2020) degil, bkz. tablo.',
  );
  assert.deepEqual(found.map((c) => [c.surname, c.year]), [
    ['Yılmaz', '2020'], ['Chen', '2021'], ['Demir', '2019'], ['Kaya', '2018'],
  ]);
});

test('sepetle eslestirme: atif yapilan, yapilmayan, karsiligi olmayan', () => {
  const papers = [
    { creator: 'Burak Demir', year: 2019 },
    { creator: 'Ahmet Yılmaz, Burak Demir, Cem Kaya', year: 2020 },
    { creator: 'Zeynep Arslan', year: 2017 },
  ];
  // Yilmaz once gecer: IEEE sirasi metindeki ilk gecise gore.
  const text = 'Ilk bulgu (Yilmaz vd., 2020). Demir (2019) ve yine (Yılmaz vd., 2020). Ayrica (Smith, 2015).';
  assert.deepEqual(matchSources(text, papers), { cited: [1, 0], uncited: [2], orphans: ['Smith, 2015'] });
  assert.deepEqual(matchSources('', papers), { cited: [], uncited: [0, 1, 2], orphans: [] });
});

// --- Atıf dizgesi (CLAUDE.md 3.1: yalnız doğrulanmış kayıttan) ---

test('metin ici atif: tek yazar, iki yazar, uc ve fazlasi', () => {
  assert.equal(inlineCitation({ creator: 'Ahmet Yilmaz', year: 2023 }), '(Yilmaz, 2023)');
  assert.equal(inlineCitation({ creator: 'Ahmet Yilmaz, Burak Demir', year: 2021 }), '(Yilmaz, 2021)');
  assert.equal(inlineCitation({ creator: 'Ahmet Yilmaz, Burak Demir, Cem Kaya', year: 2020 }), '(Yilmaz vd., 2020)');
});

test('metin ici atif: "Yilmaz A." bicimi ve eksik yil', () => {
  assert.equal(inlineCitation({ creator: 'Yilmaz A.', year: 2019 }), '(Yilmaz, 2019)');
  assert.equal(inlineCitation({ creator: 'Ahmet Yilmaz' }), '(Yilmaz, t.y.)');
  assert.equal(inlineCitation({ creator: 'Ahmet Yilmaz' }, 'en'), '(Yilmaz, n.d.)');
  assert.equal(inlineCitation({ year: 2020 }), '(2020)');
});

test('kaynakca satiri yalnizca kayitta olan alanlardan kurulur', () => {
  const line = referenceLine({
    creator: 'Chen, L., Wang, H.', year: 2021,
    title: 'Passive decay heat removal', publicationName: 'Nuclear Engineering and Design',
    doi: '10.1016/j.nucengdes.2021.111',
  });
  assert.equal(line, 'Chen, L., Wang, H. (2021). Passive decay heat removal. Nuclear Engineering and Design. https://doi.org/10.1016/j.nucengdes.2021.111');
});

test('bilinmeyen alan uydurulmaz, satirdan dusuyor', () => {
  assert.equal(referenceLine({ creator: 'Chen, L.', title: 'Bir baslik' }), 'Chen, L. Bir baslik.');
  assert.equal(referenceLine({ title: 'X', publicationName: 'Bilinmeyen Kaynak' }), 'X.');
  assert.equal(referenceLine({}), '');
});

// --- Sayfa geometrisi ---

test('A4 dikey ve yatay olculeri, kenar bosluklari', () => {
  const portrait = pageGeometry({ size: 'a4', landscape: false, margin: 'normal' });
  assert.deepEqual(portrait, { width: 210, height: 297, margin: 25.4, contentWidth: 210 - 50.8 });
  const landscape = pageGeometry({ size: 'a4', landscape: true, margin: 'narrow' });
  assert.equal(landscape.width, 297);
  assert.equal(landscape.height, 210);
  assert.equal(landscape.margin, MARGIN_PRESETS.narrow.value);
});

test('bilinmeyen boyut ve kenar sessizce A4/normal olur', () => {
  const g = pageGeometry({ size: 'yok', margin: 'yok' });
  assert.equal(g.width, PAGE_SIZES.a4.width);
  assert.equal(g.margin, MARGIN_PRESETS.normal.value);
});

test('CSS degiskenleri mm ve pt birimiyle uretiliyor', () => {
  const style = pageStyle(DEFAULT_SETUP);
  assert.equal(style['--ws-page-w'], '210mm');
  assert.equal(style['--ws-margin'], '25.4mm');
  assert.equal(style['--ws-font-size'], '12pt');
  assert.equal(style['--ws-line-height'], '1.5');
});

// --- Şablonlar (§9) ---

test('bos sablon tek bos paragraf verir', () => {
  assert.equal(templateHtml(TEMPLATES.find((x) => x.id === 'blank'), (k) => k), '<p><br></p>');
  assert.equal(templateHtml(null, (k) => k), '<p><br></p>');
});

test('IMRaD ve tez sablonlari bolum agacini kuruyor', () => {
  const t = (k) => k.replace('workspace.section.', '');
  const imrad = templateHtml(TEMPLATES.find((x) => x.id === 'imrad'), t);
  // Baslik onerilen uzunlugu, ardindaki bos paragraf rehber satirini tasir.
  assert.match(imrad, /<h2 data-target="900">intro<\/h2><p data-hint="workspace\.hint\.intro"><br><\/p>/);
  assert.equal((imrad.match(/<h2[ >]/g) || []).length, 7);

  const thesis = templateHtml(TEMPLATES.find((x) => x.id === 'thesis'), t);
  assert.equal((thesis.match(/<h1[ >]/g) || []).length, 19); // WO-011: iç kapak, onay, etik, Abstract, tablo/şekil listeleri, kısaltmalar, ÖZGEÇMİŞ eklendi
  // Hedefi olmayan bolume hedef uydurulmaz.
  assert.match(thesis, /<h1>references<\/h1>/);
});

test('alt basligi olan ust basliga bos paragraf konmuyor', () => {
  const t = (k) => k.split('.').pop();
  const prisma = templateHtml(TEMPLATES.find((x) => x.id === 'prisma'), t);
  // Giris'in hemen ardindan Gerekce gelir; arada yazilacak bos satir yok.
  assert.match(prisma, /<h2>intro<\/h2><h3 data-target="500">rationale<\/h3><p data-hint="rationale">/);
  assert.match(prisma, /<h2>method<\/h2><h3 /);
  assert.match(prisma, /<h2>results<\/h2><h3 /);
});

test('sablon metni HTML olarak kacisliyor', () => {
  const html = templateHtml(TEMPLATES.find((x) => x.id === 'imrad'), () => 'a "b" <c> & d');
  assert.ok(!html.includes('"b"'));
  assert.ok(!html.includes('<c>'));
  assert.match(html, /data-hint="a &quot;b&quot; &lt;c&gt; &amp; d"/);
});

test('her sablon bolumunun iki dilde de adi ve rehber satiri var', async () => {
  const { default: tr } = await import('../src/i18n/tr.js');
  const { default: en } = await import('../src/i18n/en.js');
  for (const template of TEMPLATES) {
    for (const lang of [tr, en]) {
      assert.ok(lang.workspace.tpl[template.id]?.name, `${template.id} adi eksik`);
    }
    for (const { key } of template.sections) {
      for (const [name, lang] of [['tr', tr], ['en', en]]) {
        assert.ok(lang.workspace.section[key], `${name}: section.${key} eksik`);
        assert.ok(lang.workspace.hint[key], `${name}: hint.${key} eksik`);
      }
    }
  }
});

test('sablonun onerilen toplam kelimesi', () => {
  assert.equal(templateWords(TEMPLATES.find((x) => x.id === 'imrad')), 250 + 900 + 1200 + 1000 + 1200 + 500);
  assert.equal(templateWords(TEMPLATES.find((x) => x.id === 'blank')), 0);
  assert.equal(templateWords(null), 0);
});

test('tez sablonu kendi sayfa ayarini getiriyor', () => {
  const thesis = TEMPLATES.find((x) => x.id === 'thesis');
  assert.equal(thesis.setup.margin, 'wide');
  assert.equal(thesis.setup.lineHeight, 2);
});

// --- Bölüm ağacı ve kelime sayımı (§13: bölüm bazında kelime, sayfa değil) ---

test('kelime sayimi bosluklara gore, bos metin sifir', () => {
  assert.equal(countWords('  Dogal   dolasim\nverimi dusuk. '), 4);
  assert.equal(countWords(''), 0);
  assert.equal(countWords(null), 0);
});

test('bolum agaci: kendi kelimesi, alt basliklarla toplam ve belge toplami', () => {
  const { headings, words } = buildOutline([
    { kind: 'text', text: 'Baslik oncesi iki kelime' },
    { kind: 'heading', level: 2, text: 'Yontem', target: 0 },
    { kind: 'text', text: 'bir iki uc' },
    { kind: 'heading', level: 3, text: 'Orneklem', target: 250 },
    { kind: 'text', text: 'dort bes' },
    { kind: 'heading', level: 3, text: 'Analiz', target: 250 },
    { kind: 'text', text: 'alti' },
    { kind: 'heading', level: 2, text: 'Bulgular', target: 1000 },
    { kind: 'text', text: 'yedi sekiz' },
  ]);
  assert.deepEqual(headings.map((h) => [h.text, h.words, h.total, h.target]), [
    ['Yontem', 3, 6, null],
    ['Orneklem', 2, 2, 250],
    ['Analiz', 1, 1, 250],
    // Ayni seviyedeki baslik ust basligin toplamina girmez.
    ['Bulgular', 2, 2, 1000],
  ]);
  assert.equal(words, 4 + 3 + 2 + 1 + 2);
  assert.deepEqual(headings.map((h) => h.index), [0, 1, 2, 3]);
});

test('bolum agaci: baslik yoksa bos, kelimeler yine sayilir', () => {
  const out = buildOutline([{ kind: 'text', text: 'yalniz metin var' }]);
  assert.deepEqual(out, { headings: [], words: 3 });
});
