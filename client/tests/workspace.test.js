import test from 'node:test';
import assert from 'node:assert/strict';

import { MARK, classifySentence, splitSentences, summarize } from '../src/components/workspace/claimDetection.js';
import { inlineCitation, referenceLine } from '../src/components/workspace/citation.js';
import { DEFAULT_SETUP, MARGIN_PRESETS, PAGE_SIZES, pageGeometry, pageStyle } from '../src/components/workspace/pageSetup.js';
import { TEMPLATES, templateHtml } from '../src/components/workspace/templates.js';

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
  assert.match(imrad, /<h2>intro<\/h2><p><br><\/p>/);
  assert.equal((imrad.match(/<h2>/g) || []).length, 7);

  const thesis = templateHtml(TEMPLATES.find((x) => x.id === 'thesis'), t);
  assert.equal((thesis.match(/<h1>/g) || []).length, 12);
  assert.match(thesis, /<h1>references<\/h1>/);
});

test('tez sablonu kendi sayfa ayarini getiriyor', () => {
  const thesis = TEMPLATES.find((x) => x.id === 'thesis');
  assert.equal(thesis.setup.margin, 'wide');
  assert.equal(thesis.setup.lineHeight, 2);
});
