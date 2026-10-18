import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-019 Faz 1 — Görsel paneli: elle tablo. Ekle › Tablo… sağ panelde
 * düzenleyiciyi açar; tablo yalnız "Belgeye ekle" ile, seçili paragrafın
 * altına, üstünde "Tablo N." başlığıyla girer (CLAUDE.md 2.9). Word'e gerçek
 * tablo olarak çıkar.
 */

const DOC = '<h1>Giriş</h1><p>Birinci paragraf burada.</p><p>İkinci paragraf.</p>';
const INDEX_KEY = 'literatur-ai:drafts:v1';

const doc = (page) => page.locator('.wx-page');
const side = (page) => page.locator('.wx-side');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

/** Panoya Excel'den kopyalanmış gibi yapıştırma olayı. */
async function paste(page, cell, { text = '', html = '' }) {
  await page.locator(`[data-cell="${cell}"]`).evaluate((el, [plain, rich]) => {
    const data = new DataTransfer();
    if (plain) data.setData('text/plain', plain);
    if (rich) data.setData('text/html', rich);
    el.focus();
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, [text, html]);
}

/** Belgenin üst düzey blokları: etiket ve kısa metin. */
const blocks = (page) => doc(page).evaluate((el) => [...el.children].map((b) => `${b.tagName} ${b.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)}`));

async function openNewTable(page, blockText) {
  await doc(page).getByText(blockText, { exact: false }).first().click();
  await page.locator('[data-action="write-insert"]').click();
  await page.locator('[data-action="insert-table"]').click();
  await expect(page.locator('[data-action="side-visual"]')).toHaveAttribute('aria-pressed', 'true');
}

test('tablo: Excel\'den yapıştır, başlık yaz, seçili paragrafın altına ekle; yenile, düzenle, numara, kaldır + geri al, Word', async ({ page }) => {
  await seedDraft(page, DOC, 'Tablo taslağı');
  await mockApi(page);
  await page.goto('/#/yaz');
  await expect(doc(page)).toContainText('Birinci paragraf');

  await openNewTable(page, 'Birinci paragraf');
  await expect(page.getByTestId('visual-target')).toContainText('“Birinci paragraf burada.” paragrafının altı');
  await expect(page.getByTestId('visual-drop')).toBeVisible();
  // Boş tablo eklenemez; neden yazılı.
  await expect(page.locator('[data-action="visual-insert"]')).toBeDisabled();
  await expect(side(page)).toContainText('en az bir hücreyi doldur');

  await paste(page, '0:0', { text: 'Grup\tn\tOrt.\r\nA\t12\t3,4\r\nB\t15\t2,9\r\n' });
  await expect(side(page)).toContainText('3 satır × 3 sütun yapıştırıldı.');
  await expect(page.locator('[data-cell="2:2"]')).toHaveValue('2,9');
  await page.locator('[data-action="visual-caption"]').fill('Katılımcılar');
  // Belge henüz değişmedi (2.9).
  expect(await blocks(page)).toEqual(['H1 Giriş', 'P Birinci paragraf burada.', 'P İkinci paragraf.']);

  await page.locator('[data-action="visual-insert"]').click();
  expect(await blocks(page)).toEqual(['H1 Giriş', 'P Birinci paragraf burada.', 'P Tablo 1. Katılımcılar', 'TABLE GrupnOrt.A123,4B152,9', 'P İkinci paragraf.']);
  await expect(doc(page).locator('table thead th')).toHaveText(['Grup', 'n', 'Ort.']);
  await expect(side(page)).toContainText('Belgede');

  // Paneldeki değişiklik belgeye yalnız "Güncelle" ile yazılır.
  await page.locator('[data-cell="1:1"]').fill('13');
  await expect(doc(page).locator('tbody tr').first().locator('td').nth(1)).toHaveText('12');
  await page.locator('[data-action="visual-update"]').click();
  await expect(doc(page).locator('tbody tr').first().locator('td').nth(1)).toHaveText('13');

  // Önüne ikinci tablo: numaralar belgedeki sıraya göre.
  await page.locator('[data-action="visual-close"]').click();
  await openNewTable(page, 'Giriş');
  await page.locator('[data-cell="0:0"]').fill('X');
  await page.locator('[data-action="visual-caption"]').fill('Önce gelen');
  await page.locator('[data-action="visual-insert"]').click();
  expect((await blocks(page)).filter((b) => b.startsWith('P Tablo'))).toEqual(['P Tablo 1. Önce gelen', 'P Tablo 2. Katılımcılar']);

  // Yenile: tablo ve başlık kayıtta; tabloya tıklayınca panel aynı içerikle açılır.
  await expect.poll(() => page.evaluate((key) => {
    const index = JSON.parse(localStorage.getItem(key) || 'null');
    const raw = index && localStorage.getItem(`literatur-ai:draft:${index.activeId}`);
    return raw ? JSON.parse(raw).html : '';
  }, INDEX_KEY), { timeout: 6000 }).toContain('Tablo 2. Katılımcılar');
  await page.reload();
  await expect(doc(page).locator('table')).toHaveCount(2);
  await doc(page).locator('table').nth(1).locator('td').first().click();
  await expect(page.locator('[data-action="side-visual"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-action="visual-caption"]')).toHaveValue('Katılımcılar');
  await expect(page.locator('[data-cell="0:0"]')).toHaveValue('Grup');
  await expect(side(page)).toContainText('Tablo 2');

  // Kaldır + geri al.
  await page.locator('[data-action="visual-remove"]').click();
  await expect(doc(page).locator('table')).toHaveCount(1);
  expect((await blocks(page)).filter((b) => b.startsWith('P Tablo'))).toEqual(['P Tablo 1. Önce gelen']);
  await page.locator('[data-action="visual-undo-remove"]').click();
  await expect(doc(page).locator('table')).toHaveCount(2);
  expect((await blocks(page)).filter((b) => b.startsWith('P Tablo'))).toEqual(['P Tablo 1. Önce gelen', 'P Tablo 2. Katılımcılar']);

  // Word: gerçek tablo, başlık tablonun üstünde.
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Word/ }).first().click()]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const xml = await zip.file('word/document.xml').async('string');
  expect(xml.match(/<w:tbl>/g)).toHaveLength(2);
  const caption = xml.indexOf('Tablo 2. Katılımcılar');
  expect(caption).toBeGreaterThan(-1);
  expect(xml.indexOf('<w:tbl>', caption)).toBeGreaterThan(caption);
  expect(xml.slice(caption, xml.indexOf('</w:tbl>', caption))).toContain('Grup');
});

test('tablo düzenleyici: Word tablosu yapıştırma, Enter/Tab, belgede doğrudan yazım panele geçer, yer tıklamayla taşınır', async ({ page }) => {
  await seedDraft(page, DOC, 'Düzenleyici taslağı');
  await mockApi(page);
  await page.goto('/#/yaz');
  await openNewTable(page, 'İkinci paragraf');

  // Yer: belgede başka paragrafa tıklayınca oraya taşınır.
  await doc(page).getByText('Birinci paragraf').click();
  await expect(page.getByTestId('visual-target')).toContainText('“Birinci paragraf burada.”');

  await paste(page, '0:0', { html: '<table><tr><td>Yöntem</td><td>n</td></tr><tr><td>Anket</td><td>40</td></tr></table>' });
  await expect(page.locator('[data-cell="1:0"]')).toHaveValue('Anket');
  // Enter alt hücreye, son satırda yeni satır açar; son hücrede Tab yeni satır.
  await page.locator('[data-cell="1:2"]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-cell="2:2"]')).toBeFocused();
  await page.locator('[data-cell="2:2"]').fill('not');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-cell="3:0"]')).toBeFocused();
  await expect(side(page)).toContainText('4 × 3');

  await page.locator('[data-action="visual-insert"]').click();
  expect((await blocks(page))[2]).toBe('P Tablo 1.');

  // Belgedeki hücreye doğrudan yaz: panel (kaydedilmemiş değişiklik yokken) okur.
  const cell = doc(page).locator('tbody tr').first().locator('td').first();
  await cell.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' formu');
  await expect(page.locator('[data-cell="1:0"]')).toHaveValue('Anket formu');
  // Panelde değişiklik varken belgede yazılırsa ezilmez; uyarı çıkar.
  await page.locator('[data-cell="1:1"]').fill('41');
  await cell.click();
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await expect(side(page)).toContainText('belgede de değişti');
  await page.locator('[data-action="visual-reread"]').click();
  await expect(page.locator('[data-cell="1:1"]')).toHaveValue('40');
  await expect(page.locator('[data-cell="1:0"]')).toHaveValue('Anket formu!');
});
