function parseYear(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) ? year : null;
}

/**
 * Kartta gösterilecek yıl. `t` sözlük fonksiyonudur (useI18n); metinler
 * card.year.* anahtarlarında.
 */
export function getYearDisplay(item, t) {
  const confidence = item?.yearConfidence || 'low';
  // `year` yalnız yayın yılından doldurulur (kaynak servisleri: year = publicationYear ?? null);
  // publicationYear taşımayan kayıtlar (paylaşım, eski geçmiş) "Yıl bilinmiyor" gösteriyordu (WO-024).
  const publicationYear = parseYear(item?.publicationYear) || parseYear(item?.year);
  if (publicationYear) {
    return {
      label: String(publicationYear),
      title: confidence === 'low' ? t('card.year.lowConfidence') : t('card.year.published', { y: publicationYear }),
      showWarning: confidence === 'low',
    };
  }

  const metadataYear = parseYear(item?.metadataYear);
  if (metadataYear) {
    return {
      label: t('card.year.metadata', { y: metadataYear }),
      title: t('card.year.metadataTitle'),
      showWarning: confidence === 'low',
    };
  }

  return { label: t('card.year.unknown'), title: t('card.year.unknownTitle'), showWarning: false };
}
