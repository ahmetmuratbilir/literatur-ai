import { Document, HeadingLevel, Packer, Paragraph, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';

export function useExport() {
  const exportPDF = (mainTopic) => {
    const element = document.getElementById('results-container');
    const opt = {
      margin: [10, 10],
      filename: `LiteratureAI_Rapor_${mainTopic || 'Arastirma'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const exportExcel = (data, mainTopic) => {
    const headers = ['Başlık', 'Yıl', 'Yazar', 'Yayın', 'DOI', 'Atıf', 'URL'];
    const rows = data.results.map(item => [
      item.title,
      item.year,
      item.creator,
      item.publicationName,
      item.doi,
      item.citedBy,
      item.url
    ]);

    let csvContent = '\uFEFF';
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `LiteratureAI_Veri_${mainTopic || 'Arastirma'}.csv`);
  };

  const exportDocx = async (data, mainTopic) => {
    const docChildren = [
      new Paragraph({ text: 'LiteratureAI Akademik Raporu', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: `Konu: ${mainTopic}`, spacing: { before: 200, after: 200 } }),
    ];
    data.results.forEach(item => {
      docChildren.push(
        new Paragraph({ text: `${item.title || 'İsimsiz'} (${item.year || '-'})`, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `Yazarlar: ${item.creator || 'Bilinmeyen'}` }),
        new Paragraph({ text: `Yayın: ${item.publicationName || '-'}` }),
        new Paragraph({ text: `DOI: ${item.doi || '-'}`, spacing: { after: 200 } }),
      );
    });
    const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `LiteratureAI_Belge_${mainTopic || 'Arastirma'}.docx`);
  };

  const exportBibTeX = (data, mainTopic) => {
    if (!data?.results?.length) return;
    const bibtexItems = data.results.map((item, idx) => {
      const author = item.creator || (Array.isArray(item.authors) ? item.authors.join(' and ') : item.authors) || 'Unknown';
      const cleanTitle = (item.title || '').replace(/[{}]/g, '');
      const year = item.year || item.publishedDate?.substring(0, 4) || new Date().getFullYear();
      const firstWord = (author.split(' ')[0] || 'paper').replace(/[^a-zA-Z0-9]/g, '');
      const key = `${firstWord}${year}_${idx + 1}`.toLowerCase();
      const journal = item.publicationName || item.source || 'Academic Publication';
      const doi = item.doi ? `,\n  doi = {${item.doi}}` : '';
      const url = item.url ? `,\n  url = {${item.url}}` : '';
      return `@article{${key},\n  author = {${author}},\n  title = {${cleanTitle}},\n  journal = {${journal}},\n  year = {${year}}${doi}${url}\n}`;
    });

    const content = bibtexItems.join('\n\n');
    const blob = new Blob([content], { type: 'application/x-bibtex;charset=utf-8;' });
    saveAs(blob, `LiteratureAI_${mainTopic ? mainTopic.replace(/[^a-zA-Z0-9]/g, '_') : 'Arastirma'}.bib`);
  };

  const exportRIS = (data, mainTopic) => {
    if (!data?.results?.length) return;
    const risItems = data.results.map(item => {
      const author = item.creator || (Array.isArray(item.authors) ? item.authors.join(' and ') : item.authors) || 'Unknown';
      const year = item.year || item.publishedDate?.substring(0, 4) || '';
      let entry = 'TY  - JOUR\n';
      entry += `TI  - ${item.title || ''}\n`;
      entry += `AU  - ${author}\n`;
      if (item.publicationName) entry += `JO  - ${item.publicationName}\n`;
      if (year) entry += `PY  - ${year}\n`;
      if (item.doi) entry += `DO  - ${item.doi}\n`;
      if (item.url) entry += `UR  - ${item.url}\n`;
      entry += 'ER  - \n';
      return entry;
    });

    const content = risItems.join('\n');
    const blob = new Blob([content], { type: 'application/x-research-info-systems;charset=utf-8;' });
    saveAs(blob, `LiteratureAI_${mainTopic ? mainTopic.replace(/[^a-zA-Z0-9]/g, '_') : 'Arastirma'}.ris`);
  };

  return { exportPDF, exportExcel, exportDocx, exportBibTeX, exportRIS };
}
