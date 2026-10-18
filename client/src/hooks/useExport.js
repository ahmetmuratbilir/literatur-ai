import { toBibTeX, toRIS, downloadText } from '../utils/citationExport.js';

// Dışa aktarma kütüphaneleri (docx, html2pdf → jsPDF + html2canvas, file-saver)
// yalnız ilgili düğmeye basılınca yüklenir (WO-024). Eskiden en üstte statik
// içe aktarılıyordu: kullanıcı hiç dışa aktarmasa bile ilk açılışta ~1 MB
// indiriliyordu ve 1 MB'ı aşan parça Windows'ta yerel build'i kırıyordu.
const loadSaveAs = () => import('file-saver').then((m) => m.saveAs || m.default);

const fileBase = (mainTopic) => `Literatur-AI_${mainTopic ? mainTopic.replace(/[^a-zA-Z0-9]/g, '_') : 'Arastirma'}`;

/**
 * CSV hücresi: boş alan boş kalır ("undefined" yazılmaz); `= + - @` ile
 * başlayan dış kaynak metni Excel'de formül olarak çalışmasın diye başına
 * `'` konur (CSV enjeksiyonu).
 */
export function csvCell(value) {
  if (value === undefined || value === null) return '""';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const authorsOf = (item) => item.creator || (Array.isArray(item.authors) ? item.authors.join(', ') : item.authors) || '';

export function useExport() {
  const exportPDF = async (mainTopic) => {
    const element = document.getElementById('results-container');
    const { default: html2pdf } = await import('html2pdf.js');
    const opt = {
      margin: [10, 10],
      filename: `${fileBase(mainTopic)}_Rapor.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    await html2pdf().set(opt).from(element).save();
  };

  const exportExcel = async (data, mainTopic) => {
    const headers = ['Başlık', 'Yıl', 'Yazar', 'Yayın', 'DOI', 'Atıf', 'URL'];
    const rows = data.results.map((item) => [
      item.title, item.year, authorsOf(item), item.publicationName, item.doi, item.citedBy, item.url,
    ]);
    let csvContent = '﻿';
    csvContent += headers.join(',') + '\n';
    rows.forEach((row) => { csvContent += row.map(csvCell).join(',') + '\n'; });
    const saveAs = await loadSaveAs();
    saveAs(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), `${fileBase(mainTopic)}_Veri.csv`);
  };

  const exportDocx = async (data, mainTopic) => {
    const [{ Document, HeadingLevel, Packer, Paragraph, AlignmentType }, saveAs] = await Promise.all([import('docx'), loadSaveAs()]);
    const docChildren = [
      new Paragraph({ text: 'Literatür AI — Akademik rapor', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Konu: ${mainTopic || '-'}`, spacing: { before: 200, after: 200 } }),
    ];
    data.results.forEach((item) => {
      docChildren.push(
        new Paragraph({ text: `${item.title || 'İsimsiz'} (${item.year || '-'})`, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `Yazarlar: ${authorsOf(item) || 'Bilinmeyen'}` }),
        new Paragraph({ text: `Yayın: ${item.publicationName || '-'}` }),
        new Paragraph({ text: `DOI: ${item.doi || '-'}`, spacing: { after: 200 } }),
      );
    });
    const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });
    saveAs(await Packer.toBlob(doc), `${fileBase(mainTopic)}_Belge.docx`);
  };

  // Toplu dışa aktarma, sepetteki dışa aktarmayla aynı üreteci kullanır:
  // RIS'te her yazar ayrı AU satırı, bilinmeyen yıl uydurulmaz.
  const exportBibTeX = (data, mainTopic) => {
    if (!data?.results?.length) return;
    downloadText(`${fileBase(mainTopic)}.bib`, toBibTeX(data.results), 'application/x-bibtex');
  };

  const exportRIS = (data, mainTopic) => {
    if (!data?.results?.length) return;
    downloadText(`${fileBase(mainTopic)}.ris`, toRIS(data.results), 'application/x-research-info-systems');
  };

  return { exportPDF, exportExcel, exportDocx, exportBibTeX, exportRIS };
}
