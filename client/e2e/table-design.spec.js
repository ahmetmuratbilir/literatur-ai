import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-031 — tablo tasarımı: Word'ün Tablo Tasarımı gibi tema galerisi ve
 * Başlık / Toplam / Bantlı satır / İlk sütun. Seçim ekranda görünür, Ctrl+Z
 * geri alır, Word'e hücre gölgesi + kenarlık + tblLook olarak geçer.
 */

const doc = (page) => page.locator('.wx-page');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

test('tema + seçenekler ekranda, geri alınır, Word\'e gölge ve tblLook olarak gider; APA varsayılan değişmez', async ({ page }) => {
  test.setTimeout(60_000);
  await seedDraft(page, '<p>Önce bir paragraf.</p><p>Sonra.</p>', 'Tablo tasarımı');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Önce').click();
  await page.keyboard.press('End');
  await page.locator('[data-action="write-table"]').click();
  const cell = page.locator('[data-action="table-grid"] [data-cell="3:2"]');
  await cell.hover();
  await cell.click();
  await page.keyboard.type('Grup');

  const table = doc(page).locator('table');
  // Varsayılan APA: tema yok, başlık zemini boş.
  await expect(table).not.toHaveAttribute('data-theme', /.+/);

  await page.locator('[data-action="table-design"]').click();
  const design = page.getByTestId('table-design');
  await expect(design).toBeVisible();
  await expect(design.locator('[data-theme-id]')).toHaveCount(20);
  await design.locator('[data-theme-id="lacivert"]').click();
  await expect(table).toHaveAttribute('data-theme', 'lacivert');
  // Galeri açık kalır; seçenekler işaretlenir.
  await design.locator('[data-action="table-flag-band"]').check();
  await design.locator('[data-action="table-flag-total"]').check();
  await expect(table).toHaveAttribute('data-band', '1');
  await expect(table).toHaveAttribute('data-total', '1');
  const headBg = await table.locator('thead th').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(headBg).toBe('rgb(30, 58, 95)');
  const bandBg = await table.locator('tbody tr').nth(1).locator('td').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bandBg).toBe('rgb(238, 242, 247)');

  // Ctrl+Z son seçeneği geri alır.
  await page.keyboard.press('Control+z');
  await expect(table).not.toHaveAttribute('data-total', '1');
  // Geri alınan tablo yeniden yerine konur; galeri kapanabilir, yeniden açılır.
  await table.locator('td').first().click();
  await page.keyboard.type('x');
  if (!(await design.isVisible())) await page.locator('[data-action="table-design"]').click();
  await design.locator('[data-action="table-flag-total"]').check();

  // Word: gölge, beyaz başlık yazısı, tblLook.
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.getByRole('button', { name: /Word/ }).first().click(),
  ]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const xml = await zip.file('word/document.xml').async('string');
  expect(xml).toMatch(/<w:shd [^>]*w:fill="1E3A5F"/);
  expect(xml).toMatch(/<w:shd [^>]*w:fill="EEF2F7"/);
  expect(xml).toMatch(/<w:color w:val="FFFFFF"\/>/);
  expect(xml).toMatch(/<w:tblLook [^>]*w:lastRow="(1|true)"/);
  expect(xml).toMatch(/<w:tblLook [^>]*w:noHBand="(0|false)"/);
});
