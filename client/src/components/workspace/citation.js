// Atıf dizgesi YALNIZCA doğrulanmış kayıttan kurulur (CLAUDE.md 3.1).
// Model çıktısındaki hiçbir dize buraya girmez.

/** "Yılmaz, A., Demir, B." → "Yılmaz" */
function firstSurname(paper) {
  const raw = String(paper?.creator || '').split(',')[0].trim();
  if (!raw) return '';
  const parts = raw.split(/\s+/);
  // "Ahmet Yılmaz" biçiminde soyadı sonda; "Yılmaz A." biçiminde başta.
  const last = parts[parts.length - 1];
  return last.length <= 2 || last.endsWith('.') ? parts[0] : last;
}

/** Metin içi atıf: (Yılmaz, 2023). Yıl yoksa (Yılmaz, t.y.). */
export function inlineCitation(paper, lang = 'tr') {
  const surname = firstSurname(paper);
  const year = paper?.year || (lang === 'tr' ? 't.y.' : 'n.d.');
  if (!surname) return `(${year})`;
  const authorCount = String(paper?.creator || '').split(',').filter(Boolean).length;
  const etAl = authorCount > 2 ? (lang === 'tr' ? ' vd.' : ' et al.') : '';
  return `(${surname}${etAl}, ${year})`;
}

/** Kaynakça satırı (APA 7'ye yakın), yalnız kayıttaki alanlardan. */
export function referenceLine(paper) {
  const bits = [
    String(paper?.creator || '').trim(),
    paper?.year ? `(${paper.year}).` : '',
    paper?.title ? `${paper.title}.` : '',
    paper?.publicationName && paper.publicationName !== 'Bilinmeyen Kaynak' ? `${paper.publicationName}.` : '',
    paper?.doi ? `https://doi.org/${paper.doi}` : '',
  ];
  return bits.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
