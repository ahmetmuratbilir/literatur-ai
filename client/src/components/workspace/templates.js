// Şablonlar (tasarim-yonu.md §9): bölüm ağacı + her bölüme rehber metni.
// Model çağrısı yok, altyapı yok — şablon pahalı bir özellik değil.
// İlk sürümde iki tane: makale ve tez. PRISMA, TÜBİTAK ve olgu sunumu sonra.

export const TEMPLATES = [
  {
    id: 'blank',
    sections: [],
  },
  {
    id: 'imrad',
    setup: { margin: 'normal', lineHeight: 1.5 },
    sections: [
      { level: 2, key: 'abstract', words: 250 },
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
];

/** Şablonu belge HTML'ine çevirir. Rehber metni boş bölümde gösterilir. */
export function templateHtml(template, t) {
  if (!template?.sections?.length) return '<p><br></p>';
  return template.sections
    .map(({ level, key }) => `<h${level}>${t(`workspace.section.${key}`)}</h${level}><p><br></p>`)
    .join('');
}
