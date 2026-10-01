/**
 * Sepetteki makaleleri referans yöneticilerine (Zotero, Mendeley, EndNote)
 * aktarılabilir biçimlere çevirir. Yalnızca elimizdeki alanlar yazılır;
 * bilinmeyen alan uydurulmaz.
 */

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const splitAuthors = (authors) => clean(authors).split(/\s*[,;]\s*/).filter(Boolean);
const bibEscape = (v) => clean(v).replace(/([{}])/g, '\\$1');

const citeKey = (paper, used) => {
  const first = splitAuthors(paper.authors || paper.creator)[0] || 'anon';
  const surname = first.split(' ').pop().normalize('NFD').replace(/[^A-Za-z]/g, '').toLowerCase() || 'anon';
  const base = `${surname}${clean(paper.year).slice(0, 4) || 'nd'}`;
  let key = base;
  let i = 1;
  while (used.has(key)) key = `${base}${String.fromCharCode(96 + i++)}`;
  used.add(key);
  return key;
};

export function toBibTeX(papers = []) {
  const used = new Set();
  return papers.map((p) => {
    const fields = [
      ['title', `{${bibEscape(p.title)}}`],
      ['author', bibEscape(splitAuthors(p.authors || p.creator).join(' and '))],
      ['year', bibEscape(p.year)],
      ['journal', bibEscape(p.publicationName)],
      ['doi', bibEscape(p.doi)],
      ['url', bibEscape(p.url)],
    ].filter(([, v]) => v && v !== '{}');
    const body = fields.map(([k, v]) => `  ${k} = {${v}}`).join(',\n');
    return `@article{${citeKey(p, used)},\n${body}\n}`;
  }).join('\n\n') + '\n';
}

export function toRIS(papers = []) {
  return papers.map((p) => {
    const lines = ['TY  - JOUR', `TI  - ${clean(p.title)}`];
    splitAuthors(p.authors || p.creator).forEach((a) => lines.push(`AU  - ${a}`));
    if (clean(p.year)) lines.push(`PY  - ${clean(p.year)}`);
    if (clean(p.publicationName)) lines.push(`JO  - ${clean(p.publicationName)}`);
    if (clean(p.doi)) lines.push(`DO  - ${clean(p.doi)}`);
    if (clean(p.url)) lines.push(`UR  - ${clean(p.url)}`);
    lines.push('ER  - ');
    return lines.join('\r\n');
  }).join('\r\n\r\n') + '\r\n';
}

export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
