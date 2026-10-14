// Şablonlar (tasarim-yonu.md §8): bölüm ağacı + her boş bölümde ne
// yazılacağını söyleyen rehber satırı. Model çağrısı yok, altyapı yok.
//
// §8 "İlk açılış": kullanıcı şablon seçmeye zorlanmaz. Şablon, isteyenin
// üst çubuktan açtığı bir menüdür.
// §13: "Şablon sayısı değer değil." Yalnız gerçek ihtiyacı olanlar.
//
// `words` şablonun önerdiği yaklaşık uzunluktur, kural değil; dergi ve
// kurum yönergesi önceliklidir ve arayüz bunu söyler. 0 = hedef yok.

// Her şablonun ortak sayfa ayarı: A4, Times New Roman 12 pt (WO-011 Faz 1).
// Şablon yalnız farklı olanı ezer.
const BASE_SETUP = { size: 'a4', landscape: false, font: 'Times New Roman', fontSize: 12 };

export const TEMPLATES = [
  {
    id: 'blank',
    setup: { ...BASE_SETUP, margin: 'normal', lineHeight: 1.5 },
    bibFormat: 'APA 7',
    sections: [],
  },
  {
    id: 'imrad',
    bibFormat: 'APA 7',
    setup: { ...BASE_SETUP, margin: 'normal', lineHeight: 1.5 },
    sections: [
      { level: 2, key: 'summary', words: 250 },
      { level: 2, key: 'intro', words: 900 },
      { level: 2, key: 'method', words: 1200 },
      { level: 2, key: 'results', words: 1000 },
      { level: 2, key: 'discussion', words: 1200 },
      { level: 2, key: 'conclusion', words: 500 },
      { level: 2, key: 'references', words: 0 },
    ],
  },
  {
    // "Genel tez şablonu" (WO-011): tezlerde ortak görülen bölümler. Belirli
    // bir enstitüye uygunluk iddiası YOK; arayüz "kendi enstitü kılavuzunla
    // karşılaştır" der. Kenar, punto, satır aralığı ayar olarak değişir.
    id: 'thesis',
    bibFormat: 'APA 7',
    setup: { ...BASE_SETUP, margin: 'wide', lineHeight: 2 },
    sections: [
      { level: 1, key: 'cover', words: 0 },
      { level: 1, key: 'innerCover', words: 0 },
      { level: 1, key: 'approval', words: 0 },
      { level: 1, key: 'ethics', words: 0 },
      { level: 1, key: 'ozet', words: 300 },
      { level: 1, key: 'abstract', words: 300 },
      { level: 1, key: 'contents', words: 0 },
      { level: 1, key: 'tableList', words: 0 },
      { level: 1, key: 'figureList', words: 0 },
      { level: 1, key: 'abbreviations', words: 0 },
      { level: 1, key: 'intro', words: 1500 },
      { level: 1, key: 'framework', words: 3000 },
      { level: 1, key: 'method', words: 2000 },
      { level: 1, key: 'results', words: 2500 },
      { level: 1, key: 'discussion', words: 2000 },
      { level: 1, key: 'conclusion', words: 1000 },
      { level: 1, key: 'references', words: 0 },
      { level: 1, key: 'appendix', words: 0 },
      { level: 1, key: 'cv', words: 0 },
    ],
  },
  {
    // Anlatı derlemesi: tematik düzen. Sistematik derleme için PRISMA iskeleti ayrı.
    id: 'review',
    bibFormat: 'APA 7',
    setup: { ...BASE_SETUP, margin: 'normal', lineHeight: 1.5 },
    sections: [
      { level: 2, key: 'summary', words: 250 },
      { level: 2, key: 'intro', words: 800 },
      { level: 2, key: 'reviewMethod', words: 500 },
      { level: 2, key: 'themes', words: 3000 },
      { level: 2, key: 'discussion', words: 1000 },
      { level: 2, key: 'conclusion', words: 500 },
      { level: 2, key: 'references', words: 0 },
    ],
  },
  {
    id: 'project',
    bibFormat: 'APA 7',
    setup: { ...BASE_SETUP, margin: 'normal', lineHeight: 1.15 },
    sections: [
      { level: 2, key: 'summary', words: 250 },
      { level: 2, key: 'intro', words: 600 },
      { level: 2, key: 'scope', words: 800 },
      { level: 2, key: 'workplan', words: 600 },
      { level: 2, key: 'outputs', words: 800 },
      { level: 2, key: 'conclusion', words: 400 },
      { level: 2, key: 'references', words: 0 },
    ],
  },
  {
    // PRISMA 2020 kontrol listesinin ANA başlıkları — 27 maddenin tamamı
    // değil. Arayüz "teslimden önce resmi listeyle karşılaştır" der.
    id: 'prisma',
    bibFormat: 'APA 7',
    setup: { ...BASE_SETUP, margin: 'normal', lineHeight: 1.5 },
    sections: [
      { level: 2, key: 'summary', words: 300 },
      { level: 2, key: 'intro', words: 0 },
      { level: 3, key: 'rationale', words: 500 },
      { level: 3, key: 'objectives', words: 150 },
      { level: 2, key: 'method', words: 0 },
      { level: 3, key: 'eligibility', words: 250 },
      { level: 3, key: 'infoSources', words: 150 },
      { level: 3, key: 'searchStrategy', words: 250 },
      { level: 3, key: 'selection', words: 200 },
      { level: 3, key: 'dataCollection', words: 200 },
      { level: 3, key: 'riskOfBias', words: 200 },
      { level: 3, key: 'synthesis', words: 250 },
      { level: 2, key: 'results', words: 0 },
      { level: 3, key: 'studySelection', words: 200 },
      { level: 3, key: 'studyCharacteristics', words: 400 },
      { level: 3, key: 'biasResults', words: 200 },
      { level: 3, key: 'synthesisResults', words: 800 },
      { level: 2, key: 'discussion', words: 1200 },
      { level: 2, key: 'registration', words: 100 },
      { level: 2, key: 'references', words: 0 },
    ],
  },
];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** Biçim seçimindeki seçenekler (WO-011): sıra ve şablon eşlemesi. */
export const FORMATS = [
  { id: 'article', template: 'imrad' },
  { id: 'thesis', template: 'thesis' },
  { id: 'review', template: 'review', systematic: 'prisma' },
  { id: 'project', template: 'project' },
  { id: 'blank', template: 'blank' },
];

const norm = (s) => String(s || '').trim().toLocaleLowerCase('tr');

/**
 * Var olan belgeyi başka bir biçime geçirirken ne yapılacağı (WO-011 Faz 1).
 * Metin SİLİNMEZ:
 * - `add`: şablonda olup belgede olmayan bölümler (adına göre eşlenir).
 * - `removable`: belgede olup şablonda olmayan VE içi boş bölümler; ancak
 *   kullanıcı onaylarsa kaldırılır. İçinde metin olan bölüm listeye girmez.
 * Kaynakça bölümü hiçbir zaman kaldırılabilir sayılmaz.
 *
 * @param {Array<{index:number, text:string, level:number, total:number}>} headings belge yapısı
 * @param {object} template hedef şablon
 * @param {(key:string)=>string} t çeviri
 * @param {(text:string)=>boolean} isReferences kaynakça başlığı mı
 */
export function planFormatChange(headings, template, t, isReferences = () => false) {
  const wanted = (template?.sections || []).map((s) => ({ ...s, name: t(`workspace.section.${s.key}`) }));
  const have = new Set(headings.map((h) => norm(h.text)));
  const wantedNames = new Set(wanted.map((s) => norm(s.name)));
  return {
    add: wanted.filter((s) => !have.has(norm(s.name))),
    removable: headings.filter((h) => h.total === 0 && !wantedNames.has(norm(h.text)) && !isReferences(h.text)),
  };
}

/** Şablondaki toplam önerilen kelime. */
export function templateWords(template) {
  return (template?.sections || []).reduce((sum, s) => sum + (s.words || 0), 0);
}

/**
 * Şablonu belge HTML'ine çevirir. Başlık önerilen uzunluğu `data-target`
 * olarak taşır; ardından gelen boş paragraf rehber satırını `data-hint`
 * olarak taşır ve kullanıcı yazınca rehber kendiliğinden kaybolur (CSS).
 * Hemen ardından alt başlık gelen üst başlığa boş paragraf konmaz.
 */
export function templateHtml(template, t) {
  const sections = template?.sections || [];
  if (!sections.length) return '<p><br></p>';
  return sections.map(({ level, key, words }, i) => {
    const target = words ? ` data-target="${words}"` : '';
    const heading = `<h${level}${target}>${escape(t(`workspace.section.${key}`))}</h${level}>`;
    const next = sections[i + 1];
    if (next && next.level > level) return heading;
    return `${heading}<p data-hint="${escape(t(`workspace.hint.${key}`))}"><br></p>`;
  }).join('');
}
