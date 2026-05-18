function parseYear(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) ? year : null;
}

export function getYearDisplay(item) {
  const confidence = item?.yearConfidence || 'low';
  const publicationYear = parseYear(item?.publicationYear);
  if (publicationYear) {
    return {
      label: String(publicationYear),
      title: confidence === 'low'
        ? 'Yayın yılı düşük güvenle doğrulanabildi.'
        : `Yayın yılı: ${publicationYear}`,
      showWarning: confidence === 'low'
    };
  }

  const metadataYear = parseYear(item?.metadataYear);
  if (metadataYear) {
    return {
      label: `Metadata yılı: ${metadataYear}`,
      title: 'Bu tarih yayın yılı değil, veri tabanı kayıt/güncelleme tarihi olabilir.',
      showWarning: confidence === 'low'
    };
  }

  return {
    label: 'Yıl doğrulanamadı',
    title: 'Yayın yılı doğrulanamadı.',
    showWarning: false
  };
}
