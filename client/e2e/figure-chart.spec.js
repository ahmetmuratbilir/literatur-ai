import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-028 — şekil ve grafik: Napkin gibi taslak alan. Açılınca belgeye girmez
 * (kayıt, kelime sayısı), "Tamam" ile şekil + "Şekil N." başlığı girer, Ctrl+Z
 * geri alır, şekle tıklayınca yeniden düzenlenir; Word'e görüntü olarak gider.
 */

const DOC = '<h1>Yöntem</h1><p>Isı çekirdekten alınır. Su buharlaşır. Yoğuşan su geri döner.</p><p>Sonraki paragraf.</p>';
const doc = (page) => page.locator('.wx-page');
const blocks = (page) => doc(page).evaluate((el) => [...el.children].map((b) => `${b.tagName}${b.classList.contains('wx-caption') ? '.cap' : ''} ${b.textContent.replace(/\s+/g, ' ').trim().slice(0, 28)}`.trim()));
const savedHtml = (page) => page.evaluate(() => {
  const index = JSON.parse(localStorage.getItem('literatur-ai:drafts:v1') || 'null');
  const raw = index && localStorage.getItem(`literatur-ai:draft:${index.activeId}`);
  return raw ? JSON.parse(raw).html : '';
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

test('şekil: taslak belgede değil; paragraftan al, Tamam, geri al, yeniden düzenle; grafik; numara; Word', async ({ page }) => {
  test.setTimeout(60_000);
  await seedDraft(page, DOC, 'Şekil denemesi');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Isı çekirdekten').click();
  const wordsBefore = await page.locator('.wx-top__words').textContent();

  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  await expect(draft).toBeVisible();
  await expect(draft).toContainText('Taslak — belgede değil');
  // Taslak belgede değil: blok yok, kelime sayısı aynı, kayda girmiyor.
  expect((await blocks(page)).filter((b) => b.startsWith('FIGURE'))).toHaveLength(0);
  await expect(page.locator('.wx-top__words')).toHaveText(wordsBefore);
  await expect(draft.locator('[data-action="fd-done"]')).toBeDisabled();

  await draft.locator('[data-fd-type="cycle"]').click();
  await draft.locator('[data-action="fd-from-paragraph"]').click();
  await expect(draft.locator('[data-fd="item"]')).toHaveCount(3);
  await expect(draft.locator('.fd-svg svg')).toContainText('Su buharlaşır');
  await draft.locator('[data-fd="caption"]').fill('Pasif soğutma döngüsü');
  await expect.poll(() => savedHtml(page), { timeout: 6000 }).not.toContain('data-draft-spacer');
  await draft.locator('[data-action="fd-done"]').click();
  await expect(draft).toHaveCount(0);
  const after = await blocks(page);
  expect(after.slice(0, 4)).toEqual(['H1 Yöntem', 'P Isı çekirdekten alınır. Su b', expect.stringMatching(/^FIGURE /), 'P.cap Şekil 1. Pasif soğutma döngü']);
  expect(after.at(-1)).toBe('P Sonraki paragraf.');

  // Ctrl+Z şekli geri alır; Ctrl+Y geri getirir.
  await page.keyboard.press('Control+z');
  await expect(doc(page).locator('figure')).toHaveCount(0);
  await page.keyboard.press('Control+y');
  await expect(doc(page).locator('figure')).toHaveCount(1);

  // Şekle tıklayınca aynı taslak alan dolu açılır; değişiklik yerinde yazılır.
  await doc(page).locator('figure').click();
  await expect(draft.locator('[data-fd="item"]').first()).toHaveValue('Isı çekirdekten alınır');
  await draft.locator('[data-fd="item"]').first().fill('Çekirdek ısısı');
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveCount(1);
  await expect(doc(page).locator('figure svg')).toContainText('Çekirdek ısısı');

  // Grafik: sayı olmayan satır çizilmez ve söylenir; numara 2.
  await doc(page).getByText('Sonraki paragraf').click();
  await page.locator('[data-action="write-chart"]').click();
  const rows = draft.locator('.fd-row:not(.fd-row--head)');
  await rows.nth(0).locator('[data-fd="chart-label"]').fill('Deney');
  await rows.nth(0).locator('[data-fd="chart-value"]').fill('3,4');
  await rows.nth(1).locator('[data-fd="chart-label"]').fill('Kontrol');
  await rows.nth(1).locator('[data-fd="chart-value"]').fill('2,9');
  await rows.nth(2).locator('[data-fd="chart-label"]').fill('Eksik');
  await rows.nth(2).locator('[data-fd="chart-value"]').fill('yok');
  await expect(draft).toContainText('1 satır sayı olmadığı için çizilmedi.');
  await expect(draft.locator('.fd-svg svg')).toContainText('3,4');
  await draft.locator('[data-fd="caption"]').fill('Grup ortalamaları');
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveCount(2);
  expect((await blocks(page)).filter((b) => b.startsWith('P.cap'))).toEqual(['P.cap Şekil 1. Pasif soğutma döngü', 'P.cap Şekil 2. Grup ortalamaları']);

  // Vazgeç: yer tutucu kalmaz.
  await doc(page).getByText('Sonraki paragraf').click();
  await page.locator('[data-action="write-figure"]').click();
  await draft.locator('[data-action="fd-cancel"]').click();
  await expect(doc(page).locator('[data-draft-spacer]')).toHaveCount(0);

  // Word: iki şekil görüntü olarak (SVG + PNG yedeği), başlıklar SEQ Şekil.
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), page.getByRole('button', { name: /Word/ }).first().click()]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const xml = await zip.file('word/document.xml').async('string');
  expect((xml.match(/<a:blip /g) || []).length).toBe(2);
  expect(xml).toMatch(/SEQ Şekil/);
  const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
  expect(media.some((f) => f.endsWith('.png'))).toBe(true);
  expect(media.some((f) => f.endsWith('.svg'))).toBe(true);
});

test('şekildeki yazılar kelime sayısına ve iddia taramasına girmez', async ({ page }) => {
  await seedDraft(page, DOC, 'Sayım denemesi');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Isı çekirdekten').click();
  const before = await page.locator('.wx-top__words').textContent();
  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  await draft.locator('[data-action="fd-from-paragraph"]').click();
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveCount(1);
  // Yalnız başlık satırı ("Şekil 1.") eklendi: 2 kelime.
  const n = (s) => Number(String(s).replace(/\D/g, ''));
  await expect.poll(async () => n(await page.locator('.wx-top__words').textContent())).toBe(n(before) + 2);
  await expect(doc(page).locator('figure [data-mark]')).toHaveCount(0);
});
