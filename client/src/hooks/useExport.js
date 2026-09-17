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

  return { exportPDF, exportExcel, exportDocx };
}
