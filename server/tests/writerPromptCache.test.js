import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WRITER_STATIC_SYSTEM_PROMPT,
  buildWriterSystemPrompt,
  getOutputLabel,
} from '../services/writerPrompt.js';

/**
 * Bu testler prompt'un ICERIGINI degil, ON-EK ONBELLEGININ (prefix cache)
 * calismasi icin gereken YAPISINI koruyor.
 *
 * Sagalayici, istemin basindan itibaren birebir eslesen parcayi ucuz
 * fiyatlandirir. Sabit blogun icine bir degisken sizdigi anda bu kazanc
 * tamamen kaybolur ve kimse fark etmez: cikti dogru gorunmeye devam eder,
 * yalnizca fatura artar. Sessiz bir regresyon oldugu icin teste baglandi.
 */

const VARIANTS = [
  { language: 'tr', outputType: 'introduction', tone: 'akademik', length: 'orta', bibliographyFormat: 'APA 7' },
  { language: 'en', outputType: 'discussion', tone: 'tez', length: 'uzun', bibliographyFormat: 'IEEE' },
  { language: 'tr', outputType: 'methodology', tone: 'sade', length: 'kisa', bibliographyFormat: 'MLA' },
  { language: 'en', outputType: 'conclusion', tone: 'makale', length: 'orta', bibliographyFormat: 'Chicago' },
  { language: 'tr', outputType: 'results', tone: undefined, length: undefined, bibliographyFormat: undefined },
  { language: undefined, outputType: 'literature-review', tone: 'akademik', length: 'uzun', bibliographyFormat: 'APA 7' },
];

function commonPrefixLength(a, b) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

test('sabit blok hicbir degisken enterpolasyonu icermiyor', () => {
  // Sablon literali derlendikten sonra `${...}` kalmis olamaz; kalan bir
  // sey varsa metne elle yazilmis demektir ve yaniltici olur.
  assert.equal(
    WRITER_STATIC_SYSTEM_PROMPT.includes('${'),
    false,
    'sabit blokta enterpolasyon izi var'
  );
});

test('sabit blok anlamli buyuklukte kaliyor', () => {
  // Onbellekten kazanilan sey bu blogun buyuklugu. Biri kurallari kuyruga
  // tasirsa optimizasyon sessizce anlamsizlasir.
  assert.ok(
    WRITER_STATIC_SYSTEM_PROMPT.length > 6000,
    `sabit blok beklenmedik sekilde kucuk: ${WRITER_STATIC_SYSTEM_PROMPT.length} karakter`
  );
});

test('her parametre kombinasyonu ayni sabit on ekle basliyor', () => {
  for (const variant of VARIANTS) {
    const prompt = buildWriterSystemPrompt(variant);
    assert.ok(
      prompt.startsWith(WRITER_STATIC_SYSTEM_PROMPT),
      `on ek bozuldu: ${JSON.stringify(variant)}`
    );
  }
});

test('tamamen farkli iki istek bile sabit blogun tamamini paylasiyor', () => {
  const a = buildWriterSystemPrompt(VARIANTS[0]);
  const b = buildWriterSystemPrompt(VARIANTS[1]);

  assert.ok(
    commonPrefixLength(a, b) >= WRITER_STATIC_SYSTEM_PROMPT.length,
    'ortak on ek sabit bloktan kisa: bir degisken yukari sizmis'
  );
});

test('yalnizca bolum degistiginde ortak on ek sabit bloktan uzun', () => {
  // Gercek kullanim: kullanici dili, uslubu, uzunlugu ve kaynakca bicimini
  // sabit tutup makalenin bolumlerini tek tek uretir. Kuyruk "en yavas
  // degisen once" siralandigi icin bu durumda sabit blogun otesinde de
  // onbellek isabeti olmali.
  const base = { language: 'tr', tone: 'akademik', length: 'orta', bibliographyFormat: 'APA 7' };
  const intro = buildWriterSystemPrompt({ ...base, outputType: 'introduction' });
  const discussion = buildWriterSystemPrompt({ ...base, outputType: 'discussion' });

  assert.ok(
    commonPrefixLength(intro, discussion) > WRITER_STATIC_SYSTEM_PROMPT.length,
    'bolum talimati kuyrugun sonunda degil: dil/uslup/uzunluk/kaynakca bloklari da iskalaniyor'
  );
});

test('bolum talimati kuyrugun en sonunda duruyor', () => {
  const base = { language: 'tr', tone: 'akademik', length: 'orta', bibliographyFormat: 'APA 7' };
  const prompt = buildWriterSystemPrompt({ ...base, outputType: 'introduction' });

  const sectionStart = prompt.indexOf('ÜRETİLECEK BÖLÜM:');
  const bibliographyStart = prompt.indexOf('KAYNAKÇA:');

  assert.ok(sectionStart > 0, 'bolum blogu bulunamadi');
  assert.ok(
    sectionStart > bibliographyStart,
    'bolum blogu kaynakcadan once geliyor: en hizli degisen boyut en sonda olmali'
  );
});

test('satir sonlari normalize: CRLF prompt byte\'larini catallamiyor', () => {
  // Depo CRLF ile checkout edilen Windows makinede ve LF ile checkout edilen
  // sunucuda ayni byte'lar gonderilmezse iki ortam birbirinin onbellegini
  // iskalar.
  const prompt = buildWriterSystemPrompt(VARIANTS[0]);
  assert.equal(prompt.includes('\r'), false, 'promptta CR karakteri var');
});

test('parametreler prompt kuyruguna gercekten yansiyor', () => {
  // Onbellek icin yapilan yeniden duzenleme sirasinda bir talimatin dusup
  // dusmedigini kontrol ediyor: hizli ama sessiz bir kayip olurdu.
  const prompt = buildWriterSystemPrompt({
    language: 'en',
    outputType: 'discussion',
    tone: 'tez',
    length: 'uzun',
    bibliographyFormat: 'IEEE',
  });

  assert.match(prompt, /YAZIM DİLİ: Metni English dilinde üret\./);
  assert.match(prompt, /doktora tezinin standartlarına uygun/);
  assert.match(prompt, /En az 5 veya daha fazla paragraf/);
  assert.match(prompt, /İç atıfları IEEE formatında yap/);
  assert.match(prompt, /TARTIŞMA BÖLÜMÜ/);
});

test('modelden kaynakca YAZMAMASI isteniyor', () => {
  // Kunye blogu (dergi, DOI, URL) artik prompt'a girmiyor. Model yine de
  // kaynakca yazmaya kalkarsa elindeki eksik veriyle uydurmak zorunda kalir;
  // bu yuzden talimat acik ve bicimden bagimsiz.
  for (const format of ['APA 7', 'IEEE', 'MLA', 'Chicago']) {
    const prompt = buildWriterSystemPrompt({
      language: 'tr',
      outputType: 'introduction',
      tone: 'akademik',
      length: 'orta',
      bibliographyFormat: format,
    });

    assert.match(prompt, /kaynakça veya referans listesi YAZMA/, `bicim: ${format}`);
    assert.match(prompt, /Dergi adı, DOI veya URL bilgisi sana verilmedi/, `bicim: ${format}`);
  }
});

test('kaynakca talimati artik bicime gore catallanmiyor', () => {
  // Blok bicimden bagimsiz hale geldigi icin yalnizca kaynakca bicimi degisen
  // iki istek, prompt'un ic atif satirina kadar ayni. Onbellek acisindan bir
  // catallanma noktasi daha kapandi.
  const base = { language: 'tr', outputType: 'introduction', tone: 'akademik', length: 'orta' };
  const apa = buildWriterSystemPrompt({ ...base, bibliographyFormat: 'APA 7' });
  const ieee = buildWriterSystemPrompt({ ...base, bibliographyFormat: 'IEEE' });

  const apaTail = apa.slice(apa.indexOf('KAYNAKÇA:'));
  const ieeeTail = ieee.slice(ieee.indexOf('KAYNAKÇA:'));

  assert.equal(apaTail, ieeeTail, 'kaynakca blogu hala bicime gore degisiyor');
});

test('bilinmeyen bolum turu varsayilan etikete dusuyor', () => {
  assert.equal(getOutputLabel('boyle-bir-sey-yok'), 'Akademik Metin');
  assert.equal(getOutputLabel('introduction'), 'Giriş Bölümü');
});
