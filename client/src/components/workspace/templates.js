// Şablonlar (tasarim-yonu.md §8): bölüm ağacı + her boş bölümde ne
// yazılacağını söyleyen rehber satırı. Model çağrısı yok, altyapı yok.
//
// §8 "İlk açılış": kullanıcı şablon seçmeye zorlanmaz. Şablon, isteyenin
// üst çubuktan açtığı bir menüdür.
// §13: "Şablon sayısı değer değil." Yalnız gerçek ihtiyacı olanlar.
//
// `words` şablonun önerdiği yaklaşık uzunluktur, kural değil; dergi ve
// kurum yönergesi önceliklidir ve arayüz bunu söyler. 0 = hedef yok.

export const TEMPLATES = [
  {
    id: 'blank',
    sections: [],
  },
  {
    id: 'imrad',
    setup: { margin: 'normal', lineHeight: 1.5 },
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
    // YÖK yönetmeliğinin ortak iskeleti. Üniversite farkları (kenar boşluğu,
    // punto, satır aralığı) ayar olarak kalır — tek şablon hepsine uyar.
    id: 'thesis',
    setup: { margin: 'wide', lineHeight: 2 },
    sections: [
      { level: 1, key: 'cover', words: 0 },
      { level: 1, key: 'ozet', words: 300 },
      { level: 1, key: 'abstract', words: 300 },
      { level: 1, key: 'contents', words: 0 },
      { level: 1, key: 'intro', words: 1500 },
      { level: 1, key: 'framework', words: 3000 },
      { level: 1, key: 'method', words: 2000 },
      { level: 1, key: 'results', words: 2500 },
      { level: 1, key: 'discussion', words: 2000 },
      { level: 1, key: 'conclusion', words: 1000 },
      { level: 1, key: 'references', words: 0 },
      { level: 1, key: 'appendix', words: 0 },
    ],
  },
  {
    // PRISMA 2020 kontrol listesinin ANA başlıkları — 27 maddenin tamamı
    // değil. Arayüz "teslimden önce resmi listeyle karşılaştır" der.
    id: 'prisma',
    setup: { margin: 'normal', lineHeight: 1.5 },
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
