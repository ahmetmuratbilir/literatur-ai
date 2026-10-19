import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-025 — Word gibi tablo: biçim çubuğundaki Tablo ızgarasından boyut seçilir,
 * tablo belgede düzenlenir (Tab, Enter, araç çubuğu), Ctrl+Z geri alır, başlık
 * numarası kendini günceller, Word'e SEQ alanlı başlık ve APA tabloyla çıkar.
 */

const DOC = '<h1>Giriş</h1><p>Birinci paragraf.</p><p>İkinci paragraf.</p>';
const doc = (page) => page.locator('.wx-page');
const blocks = (page) => doc(page).evaluate((el) => [...el.children].map((b) => `${b.tagName}${b.classList.contains('wx-caption') ? '.cap' : ''} ${b.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)}`.trim()));
const captions = async (page) => (await blocks(page)).filter((b) => b.startsWith('P.cap'));
const shape = (page, i = 0) => doc(page).locator('table').nth(i).evaluate((t) => ({ rows: t.rows.length, cols: t.rows[0].cells.length }));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

async function insertTable(page, blockText, rows, cols) {
  await doc(page).getByText(blockText).first().click();
  await page.keyboard.press('End');
  await page.locator('[data-action="write-table"]').click();
  const cell = page.locator(`[data-action="table-grid"] [data-cell="${rows - 1}:${cols - 1}"]`);
  await cell.hover();
  await expect(page.locator('.wx-tgrid__label')).toHaveText(`${cols} sütun × ${rows} satır`);
  await cell.click();
}

test('ızgaradan tablo: yerinde yazım, Tab ve son hücrede yeni satır, Ctrl+Z, araç çubuğu, numara, sil + geri al, Word', async ({ page }) => {
  test.setTimeout(60_000); // uzun yolculuk: ekle → düzenle → numara → sil → Word
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await seedDraft(page, DOC, 'Tablo denemesi');
  await mockApi(page);
  await page.goto('/#/yaz');
  await expect(doc(page)).toContainText('Birinci paragraf');

  await insertTable(page, 'Birinci paragraf', 3, 2);
  expect(await blocks(page)).toEqual(['H1 Giriş', 'P Birinci paragraf.', 'P.cap Tablo 1.', 'TABLE', 'P İkinci paragraf.']);
  expect(await shape(page)).toEqual({ rows: 3, cols: 2 });
  await expect(doc(page).locator('table thead th')).toHaveCount(2);

  // İmleç ilk başlık hücresinde: yaz, Tab'la ilerle.
  await page.keyboard.type('Grup');
  await page.keyboard.press('Tab');
  await page.keyboard.type('n');
  await page.keyboard.press('Tab');
  await page.keyboard.type('A');
  await page.keyboard.press('Tab');
  await page.keyboard.type('12');
  await page.keyboard.press('Tab');
  await page.keyboard.type('B');
  await page.keyboard.press('Tab');
  await page.keyboard.type('15');
  await expect(doc(page).locator('table tbody tr').nth(1)).toHaveText('B15');
  // Son hücrede Tab yeni satır açar; Ctrl+Z geri alır.
  await page.keyboard.press('Tab');
  expect(await shape(page)).toEqual({ rows: 4, cols: 2 });
  await page.keyboard.press('Control+z');
  expect(await shape(page)).toEqual({ rows: 3, cols: 2 });
  await expect(doc(page).locator('table tbody tr').nth(1)).toHaveText('B15');

  // Araç çubuğu: imleç tablodayken görünür; sütun ekle/sil.
  await doc(page).locator('table td').first().click();
  const bar = page.getByTestId('table-toolbar');
  await expect(bar).toBeVisible();
  await bar.locator('[data-action="table-col-right"]').click();
  expect(await shape(page)).toEqual({ rows: 3, cols: 3 });
  await bar.locator('[data-action="table-del-col"]').click();
  expect(await shape(page)).toEqual({ rows: 3, cols: 2 });

  // Hücredeki kalın yazı satır eklemede korunur.
  const a = doc(page).locator('table tbody tr').first().locator('td').first();
  await a.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.press('Control+b');
  await bar.locator('[data-action="table-row-below"]').click();
  expect(await shape(page)).toEqual({ rows: 4, cols: 2 });
  expect(await doc(page).locator('table tbody tr').first().locator('td').first().evaluate((td) => Boolean(td.querySelector('b, strong, [style*="bold"], [style*="700"]')))).toBe(true);

  // Başlığa başlık yaz, italik yap: yeniden numaralamada biçim bozulmaz.
  const cap = doc(page).locator('p.wx-caption').first();
  await cap.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Katılımcılar');
  await page.keyboard.press('Shift+Control+ArrowLeft');
  await page.keyboard.press('Control+i');

  // Önüne ikinci tablo: numaralar belgedeki sıraya göre.
  await insertTable(page, 'Giriş', 2, 2);
  expect(await captions(page)).toEqual(['P.cap Tablo 1.', 'P.cap Tablo 2. Katılımcılar']);
  expect(await doc(page).locator('p.wx-caption').nth(1).evaluate((p) => Boolean(p.querySelector('i, em, [style*="italic"]')))).toBe(true);

  // İlk tabloyu sil: kalan "Tablo 1." olur; Ctrl+Z geri getirir, başlık yine bağlı.
  await doc(page).locator('table').first().locator('th').first().click();
  await page.getByTestId('table-toolbar').locator('[data-action="table-delete"]').click();
  await expect(doc(page).locator('table')).toHaveCount(1);
  expect(await captions(page)).toEqual(['P.cap Tablo 1. Katılımcılar']);
  await page.keyboard.press('Control+z');
  await expect(doc(page).locator('table')).toHaveCount(2);
  await expect.poll(() => captions(page)).toEqual(['P.cap Tablo 1.', 'P.cap Tablo 2. Katılımcılar']);

  // Word: SEQ alanı, Caption stili, keepNext, başlık satırı tekrarı.
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }).catch((e) => { throw new Error(`${e.message}\nsayfa hataları: ${errors.join(' | ')}`); }),
    page.getByRole('button', { name: /Word/ }).first().click(),
  ]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const xml = await zip.file('word/document.xml').async('string');
  expect(xml.match(/<w:tbl>/g)).toHaveLength(2);
  expect(xml).toMatch(/SEQ Tablo/);
  expect(xml).toContain('<w:pStyle w:val="Caption"/>');
  expect(xml).toContain('<w:keepNext/>');
  expect(xml).toContain('<w:tblHeader/>');
});

test('hücrede Enter satır sonu; hücre başında Backspace tabloyu yırtmaz; Alt+Shift+↓ satırı taşır', async ({ page }) => {
  await seedDraft(page, DOC, 'Tablo denemesi 2');
  await mockApi(page);
  await page.goto('/#/yaz');
  await insertTable(page, 'İkinci paragraf', 3, 2);
  await page.keyboard.type('Başlık');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('bir');
  await page.keyboard.press('Enter');
  await page.keyboard.type('iki');
  const firstBody = doc(page).locator('table tbody tr').first().locator('td').first();
  await expect(firstBody.locator('br')).toHaveCount(1);
  expect(await shape(page)).toEqual({ rows: 3, cols: 2 });
  // Hücre başında Backspace: hiçbir şey birleşmez.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  expect(await shape(page)).toEqual({ rows: 3, cols: 2 });
  // Satırı aşağı taşı.
  await firstBody.click();
  await page.keyboard.press('Alt+Shift+ArrowDown');
  await expect(doc(page).locator('table tbody tr').nth(1).locator('td').first()).toContainText('bir');
});
