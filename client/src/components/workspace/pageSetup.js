// Sayfa geometrisi tek yerde: cetvel, ekrandaki sayfa, yazdırma ve .docx
// aynı değerleri kullanır. Ölçüler milimetre.

export const PAGE_SIZES = {
  a4: { id: 'a4', label: 'A4', width: 210, height: 297 },
  letter: { id: 'letter', label: 'Letter', width: 215.9, height: 279.4 },
};

export const MARGIN_PRESETS = {
  narrow: { id: 'narrow', value: 12.7 },
  normal: { id: 'normal', value: 25.4 },
  wide: { id: 'wide', value: 38.1 },
};

export const FONTS = [
  { id: 'Times New Roman', label: 'Times New Roman' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Cambria', label: 'Cambria' },
  { id: 'Arial', label: 'Arial' },
  { id: 'Calibri', label: 'Calibri' },
  { id: 'Verdana', label: 'Verdana' },
];

export const FONT_SIZES = [9, 10, 11, 12, 14, 16, 18, 24];

// Kurum yönergelerinde geçen değerler: tek, 1,15, 1,5 (çoğu tez), çift.
export const LINE_HEIGHTS = [1, 1.15, 1.5, 2];

export const DEFAULT_SETUP = {
  size: 'a4',
  landscape: false,
  margin: 'normal',
  font: 'Times New Roman',
  fontSize: 12,
  lineHeight: 1.5,
};

/** Yön uygulanmış sayfa ölçüleri ve kenar boşluğu (mm). */
export function pageGeometry(setup) {
  const size = PAGE_SIZES[setup.size] || PAGE_SIZES.a4;
  const margin = (MARGIN_PRESETS[setup.margin] || MARGIN_PRESETS.normal).value;
  const width = setup.landscape ? size.height : size.width;
  const height = setup.landscape ? size.width : size.height;
  return { width, height, margin, contentWidth: width - margin * 2 };
}

/** Sayfayı ve cetveli besleyen CSS değişkenleri. */
export function pageStyle(setup) {
  const g = pageGeometry(setup);
  return {
    '--ws-page-w': `${g.width}mm`,
    '--ws-page-h': `${g.height}mm`,
    '--ws-margin': `${g.margin}mm`,
    '--ws-content-w': `${g.contentWidth}mm`,
    '--ws-font': setup.font,
    '--ws-font-size': `${setup.fontSize}pt`,
    '--ws-line-height': String(setup.lineHeight),
  };
}
