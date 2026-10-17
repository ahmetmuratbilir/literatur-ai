/* global process */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockApi } from './fixtures.js';

/**
 * Kabul yolculuğu: canlıya çıkmadan önce kullanıcının elle yaptığı kontrolün
 * otomatik hali (WO-011 kontrol listesi, madde 1 ve 3–9). Tek kullanıcı, baştan
 * sona tek akış: ara → sepete ekle → taslak aç → yaz → kayıt → Çalışmalarım →
 * atıf → Kontrol → Teslime hazırla (DOCX) → seçim menüsü. Her adımda ekran
 * görüntüsü `KONTROL_OUT` klasörüne yazılır (rapor bunları gösterir).
 * Sunucu sahte (fixtures.js); taslaklar gerçek localStorage'da.
 */

const OUT = process.env.KONTROL_OUT || path.join('kontrol-raporu', 'ekran');
const INDEX_KEY = 'literatur-ai:drafts:v1';
const doc = (page) => page.locator('.wx-page');
const prep = (page) => page.getByTestId('submit-prep');
const CLAIM = 'Pasif soğutma sistemleri kaza riskini belirgin biçimde azaltir.';

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

test('kabul yolculuğu: araştırmadan teslime', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const api = await mockApi(page);
  await page.route('http://localhost:3000/api/language-edit', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', revised: 'Pasif soğutma sistemleri kaza riskini belirgin biçimde azaltır.', notes: ['Yazım düzeltildi'], model: 'sahte', promptVersion: 'PR11.v1' }),
  }));
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

  await test.step('1 · Araştırma: ara, sonuçlar gelsin, sepete 2 makale ekle', async () => {
    await page.goto('/');
    await page.locator('#topic-input').fill('pasif soğutma');
    await page.getByRole('button', { name: 'Ara', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Makalene ekle' })).toHaveCount(2);
    await page.getByRole('button', { name: 'Makalene ekle' }).first().click();
    await expect(page.getByRole('button', { name: 'Makalen için tutuldu' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Makalene ekle' }).first().click();
    await expect(page.getByRole('button', { name: 'Makalen için tutuldu' })).toHaveCount(2);
    expect(api.basket).toHaveLength(2);
    await shot('1-arastirma');
  });

  await test.step('3 · Biçim seçici: Makale seç, oluştur', async () => {
    await page.locator('[data-action="writer-dock"]').click();
    await page.locator('[data-action="format-article"]').click();
    await shot('3-bicim');
    await page.locator('[data-action="format-name"]').fill('Kabul makalesi');
    await page.locator('[data-action="format-confirm"]').click();
    await expect(doc(page)).toBeVisible();
  });

  await test.step('4 · Yaz ve otomatik kayıt: yenileyince metin yerinde', async () => {
    await doc(page).locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(` ${CLAIM}`);
    await expect.poll(() => page.evaluate((key) => {
      const index = JSON.parse(localStorage.getItem(key) || 'null');
      const raw = index && localStorage.getItem(`literatur-ai:draft:${index.activeId}`);
      return raw ? JSON.parse(raw).html : '';
    }, INDEX_KEY), { timeout: 6000 }).toContain(CLAIM);
    await page.reload();
    await expect(doc(page)).toContainText(CLAIM);
    await shot('4-yaz-kayit');
  });

  await test.step('5 · Çalışmalarım: çoğalt, yeniden adlandır, sil + geri al', async () => {
    await page.locator('.wx-exit').click();
    await expect(page.locator('#topic-input')).toBeVisible();
    if (!(await page.getByTestId('sidebar-works').isVisible())) {
      await page.getByRole('button', { name: 'Çalışmalarım', exact: true }).click();
    }
    const drafts = page.locator('[data-draft-id]');
    await expect(drafts).toHaveCount(1);
    await page.locator('[data-action="draft-duplicate"]').first().click();
    await expect(drafts).toHaveCount(2);
    page.once('dialog', (d) => d.accept('Kabul — yeniden adlandırıldı'));
    await page.locator('[data-action="draft-rename"]').first().click();
    await expect(page.getByTestId('sidebar-works')).toContainText('Kabul — yeniden adlandırıldı');
    page.once('dialog', (d) => d.accept());
    await page.locator('[data-action="draft-delete"]').first().click();
    await expect(drafts).toHaveCount(1);
    await page.locator('[data-action="toast-action"]').click();
    await expect(drafts).toHaveCount(2);
    await shot('5-calismalarim');
  });

  await test.step('6 · Sağ panel: sepetteki makaleyi atıf olarak ekle', async () => {
    await page.locator('[data-action="draft-open"]').first().click();
    await expect(doc(page)).toContainText(CLAIM);
    await page.locator('[data-action="side-sources"]').click();
    await page.locator('[data-action="side-source-open"]').first().click();
    await doc(page).locator('p', { hasText: CLAIM }).click();
    await page.keyboard.press('End');
    await page.locator('[data-action="write-cite"]').click();
    await expect(doc(page)).toContainText(/2021\)/);
    await shot('6-atif');
  });

  await test.step('7 · Kontrol sekmesi: uyarılar listeleniyor', async () => {
    await page.locator('[data-action="side-check"]').click();
    await expect(page.locator('[data-action="side-check"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.wx-side [data-rule]').first()).toBeVisible();
    await shot('7-kontrol');
  });

  await test.step('8 · Teslime hazırla: Kontrol → Dışa aktar, Word iner', async () => {
    await page.locator('[data-action="write-submit"]').click();
    await expect(prep(page)).toBeVisible();
    await shot('8a-teslim-kontrol');
    await prep(page).locator('[data-action="prep-step-export"]').click();
    const [word] = await Promise.all([page.waitForEvent('download'), prep(page).locator('[data-action="prep-run"]').click()]);
    expect(word.suggestedFilename()).toMatch(/\.docx$/);
    const bytes = fs.readFileSync(await word.path()).toString('latin1');
    expect(bytes).toContain('word/document.xml');
    fs.copyFileSync(await word.path(), path.join(OUT, 'kabul.docx'));
    await shot('8b-teslim-disa-aktar');
    await prep(page).locator('[data-action="prep-close"]').click();
    await expect(prep(page)).toHaveCount(0);
  });

  await test.step('9 · Seçim menüsü: Dil ve anlatımı düzelt, Uygula ve Geri al', async () => {
    const before = await doc(page).innerText();
    await doc(page).locator('p', { hasText: CLAIM }).evaluate((el, claim) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const i = node.textContent.indexOf(claim);
        if (i >= 0) {
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + claim.length);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
          return;
        }
      }
    }, CLAIM);
    await expect(page.locator('.wx-selbar')).toBeVisible();
    await page.locator('[data-action="selbar-ai"]').click();
    await page.locator('[data-action="selbar-ai-language"]').click();
    await expect(page.getByTestId('assist-suggestion')).toBeVisible();
    expect(await doc(page).innerText()).toBe(before);
    await shot('9a-oneri');
    await page.locator('[data-action="assist-apply"]').click();
    await expect(doc(page)).toContainText('belirgin biçimde azaltır.');
    await page.locator('[data-action="assist-undo"]').click();
    // Birebir: atıftan önceki boşluk dahil (bulgu: insertText onu U+00A0 yapıyordu).
    await expect.poll(() => doc(page).innerText()).toBe(before);
    await shot('9b-geri-al');
  });

  await test.step('Genel: yolculuk boyunca sayfa hatası yok', async () => {
    expect(errors).toEqual([]);
  });
});
