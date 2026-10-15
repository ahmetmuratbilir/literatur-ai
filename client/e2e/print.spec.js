import { test, expect } from '@playwright/test';
import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-011 Faz 3 ek — Yazdır / PDF. Tarayıcının yazdırma penceresi otomasyonla
 * açılamaz; onun yerine Chromium'un aynı yazdırma motoruyla PDF üretilir
 * (`page.pdf`, CSS'teki `@page` kuralına uyar) ve ölçülür: kağıt boyutu,
 * sayfa sayısı, kağıda çıkan satır sayısı ve yazdırmada arayüzün gizlenmesi.
 */

// 150 tek satırlık paragraf: kağıtta en az 150 metin satırı ve en az 3 sayfa olmalı.
const LINES = 150;
const LONG = `<h1>Giriş</h1>${Array.from({ length: LINES }, (_, i) => `<p>Satır ${i + 1}: pasif soğutma.</p>`).join('')}<h1>Kaynakça</h1>`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
  });
});

/** PDF'teki sayfa sayısı, kağıt boyutları (pt) ve yazılan metin satırları. */
function pdfPages(buffer) {
  const text = buffer.toString('latin1');
  const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const pages = (text.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  // İçerik akışları sıkıştırılmış; açılıp metin gösterme işlemleri (TJ/Tj) sayılır.
  let lines = 0;
  for (const m of text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const body = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
      lines += (body.match(/\bT[Jj]\b/g) || []).length;
    } catch { /* sıkıştırılmamış ya da yazı tipi akışı */ }
  }
  return { pages, boxes, lines };
}

test('yazdırma A4 (@page) kağıda çıkar; uzun belge kırpılmadan sayfalara bölünür', async ({ page }) => {
  await seedDraft(page, LONG, 'Yazdırma');
  await mockApi(page);
  await page.goto('/#/yazar');
  await expect(page.locator('.wx-page')).toContainText(`Satır ${LINES}:`);
  // Kural belgede: A4 = 210 × 297 mm
  const rule = await page.evaluate(() => [...document.querySelectorAll('style')].map((n) => n.textContent).find((x) => x.includes('@page')) || '');
  expect(rule).toMatch(/@page \{ size: 210mm 297mm; margin: [\d.]+mm; \}/);

  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: false });
  const { pages, boxes, lines } = pdfPages(pdf);
  expect(boxes.length).toBeGreaterThan(0);
  for (const [w, h] of boxes) {
    expect(Math.abs(w - 595.28)).toBeLessThan(1.5);
    expect(Math.abs(h - 841.89)).toBeLessThan(1.5);
  }
  // Kırpılma olursa satırlar eksik çıkar (eski hata: 2. sayfada kesiliyordu).
  expect(lines, 'her satır kağıda çıkmalı').toBeGreaterThanOrEqual(LINES);
  expect(pages).toBeGreaterThanOrEqual(3);
});

test('yazdırma ortamında arayüz gizlenir, yalnız belge görünür', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Atıfsız iddia cümlesi kaza riskini azaltır.</p><p>Bu bulgu (Yılmaz, 2023).</p>', 'Yazdırma');
  await mockApi(page);
  await page.goto('/#/yazar');
  await expect(page.locator('[data-action="check-marker"]').first()).toBeVisible();
  await page.locator('[data-action="write-submit"]').click();
  await page.emulateMedia({ media: 'print' });

  const visibility = (selector) => page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return s.display === 'none' || s.visibility === 'hidden' ? 'hidden' : 'visible';
  });
  for (const selector of ['#root', '.wx-top', '.wx-ribbon', '.wx-nav', '.wx-side', '.wx-status', '[data-action="check-marker"]', '[data-testid="submit-prep"]']) {
    if (await page.locator(selector).count() === 0) continue;
    expect(await visibility(selector), selector).toBe('hidden');
  }
  expect(await visibility('.wx-page')).toBe('visible');
  expect(await visibility('.wx-page p')).toBe('visible');
  // Ekrandaki işaret çubukları kağıda geçmez.
  const after = await page.locator('.wx-page > [data-mark]').first().evaluate((el) => getComputedStyle(el, '::after').display);
  expect(after).toBe('none');
});
