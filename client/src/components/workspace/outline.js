// Bölüm ağacı ve kelime sayımı — DOM'a dokunmaz, test edilebilir.
//
// tasarim-yonu.md §13: "Hedef sayfa 12/16" yapılmaz; tez sayfa sayısıyla
// ilerlemiyor. Doğru ölçü bölüm bazında kelimedir. Hedef yalnız şablondan
// gelen başlıkta vardır; kullanıcının açtığı başlığa hedef uydurulmaz.

export function countWords(text) {
  const s = String(text || '').trim();
  return s ? s.split(/\s+/).length : 0;
}

/**
 * items: [{ kind: 'heading', level, text, target } | { kind: 'text', text }]
 *
 * Her başlık için `words` (yalnız kendi gövdesi) ve `total` (alt başlıklar
 * dahil) döner. Üst başlığın toplamı, kendisinden derin seviyedeki ardışık
 * başlıkları kapsar: "Yöntem" altındaki "Örneklem"in kelimeleri Yöntem'e de
 * sayılır.
 */
export function buildOutline(items) {
  const headings = [];
  let current = null;
  let preamble = 0;

  for (const item of items) {
    if (item.kind === 'heading') {
      current = {
        index: headings.length,
        level: item.level,
        text: item.text,
        target: item.target > 0 ? item.target : null,
        words: 0,
        total: 0,
      };
      headings.push(current);
    } else if (current) {
      current.words += countWords(item.text);
    } else {
      preamble += countWords(item.text);
    }
  }

  for (let i = 0; i < headings.length; i += 1) {
    let total = headings[i].words;
    for (let j = i + 1; j < headings.length && headings[j].level > headings[i].level; j += 1) {
      total += headings[j].words;
    }
    headings[i].total = total;
  }

  const words = preamble + headings.reduce((sum, h) => sum + h.words, 0);
  return { headings, words };
}
