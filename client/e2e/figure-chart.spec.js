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

  // Tek tık yalnız seçer (WO-030); çift tıklayınca aynı taslak alan dolu açılır; değişiklik yerinde yazılır.
  await doc(page).locator('figure').click();
  await expect(draft).toHaveCount(0);
  await doc(page).locator('figure').dblclick();
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

test('görünüm: siyah-beyaz baskı + çizgili seçilir, şekille saklanır, Düzenle\'de geri gelir, Word\'e geçer', async ({ page }) => {
  test.setTimeout(60_000);
  await seedDraft(page, DOC, 'Görünüm denemesi');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Sonraki paragraf').click();
  await page.locator('[data-action="write-chart"]').click();
  const draft = page.getByTestId('figure-draft');
  const rows = draft.locator('.fd-row:not(.fd-row--head)');
  await rows.nth(0).locator('[data-fd="chart-label"]').fill('Deney');
  await rows.nth(0).locator('[data-fd="chart-value"]').fill('3,4');
  await rows.nth(1).locator('[data-fd="chart-label"]').fill('Kontrol');
  await rows.nth(1).locator('[data-fd="chart-value"]').fill('2,9');
  // Varsayılan: bölüm kapalı, desen yok.
  const look = draft.locator('[data-fd="look"]');
  await expect(look).not.toHaveAttribute('open', '');
  await expect(draft.locator('.fd-svg svg pattern')).toHaveCount(0);
  await look.locator('summary').click();
  // Palet ◀ ▶ ile gezilir: varsayılan → gri → renk körü dostu → siyah-beyaz.
  for (let n = 0; n < 3; n += 1) await look.locator('[data-fd-look="palette-next"]').click();
  await expect(look.locator('[data-fd-look="palette"]')).toContainText('Siyah-beyaz baskı');
  await look.locator('[data-fd-look="pattern-stripes"]').check();
  await expect(draft.locator('.fd-svg svg pattern')).toHaveCount(2);
  await draft.locator('[data-action="fd-done"]').click();
  await expect(draft).toHaveCount(0);

  const fig = doc(page).locator('figure');
  await expect(fig).toHaveCount(1);
  await expect(fig.locator('svg pattern')).toHaveCount(2);
  const state = JSON.parse(await fig.getAttribute('data-visual-state'));
  expect(state.data.appearance).toEqual({ palette: 'bw', pattern: 'stripes', corners: 'round', text: 'normal', width: 100, textPt: null });
  // Desen kimlikleri şekle özgü; çubuklar kendi SVG'sindeki tanıma başvurur.
  const patternIds = await fig.locator('svg pattern').evaluateAll((ps) => ps.map((p) => p.id));
  expect(patternIds.every((id) => /^v\w+-p\d$/.test(id))).toBe(true);

  // Yeniden aç: seçimler geri gelir, bölüm açık.
  await fig.dblclick();
  await expect(draft).toBeVisible();
  await expect(draft.locator('[data-fd="look"]')).toHaveAttribute('open', '');
  await expect(draft.locator('[data-fd-look="palette"]')).toHaveAttribute('data-value', 'bw');
  await expect(draft.locator('[data-fd-look="pattern-stripes"]')).toBeChecked();
  await expect(draft.locator('[data-fd-look="corners-round"]')).toBeChecked();
  await expect(draft.locator('[data-fd="pt"]')).toHaveValue('');
  // Önizlemenin desen kimlikleri belgedeki şekilden farklı (aynı sayfada çakışmasın).
  const draftIds = await draft.locator('.fd-svg svg pattern').evaluateAll((ps) => ps.map((p) => p.id));
  expect(draftIds.some((id) => patternIds.includes(id))).toBe(false);
  await draft.locator('[data-action="fd-cancel"]').click();

  // Word: SVG desenle gider; PNG yedeği de üretilir.
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15_000 }), page.getByRole('button', { name: /Word/ }).first().click()]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));
  const svgFile = media.find((f) => f.endsWith('.svg'));
  expect(media.some((f) => f.endsWith('.png'))).toBe(true);
  expect(await zip.file(svgFile).async('string')).toMatch(/<pattern id="v\w+-p0"/);
});

test('WO-032 şablon şeridi: şablon değişince içerik korunur, sığmayan öğe sayılır, ipucu görünür; yeni grafikler', async ({ page }) => {
  test.setTimeout(60_000);
  await seedDraft(page, DOC, 'Şablon şeridi');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Isı çekirdekten').click();
  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  const items = ['Sistematik derleme', 'Randomize deney', 'Kohort', 'Vaka-kontrol', 'Kesitsel', 'Vaka serisi', 'Uzman görüşü'];
  const inputs = draft.locator('[data-fd="item"]');
  for (let i = 0; i < items.length; i += 1) {
    if (i >= (await inputs.count())) await draft.getByRole('button', { name: /Öğe ekle/ }).click();
    await inputs.nth(i).fill(items[i]);
  }
  // Piramit 6 katman alır: 1 öğe görünmez, silinmez.
  await draft.locator('[data-fd-type="pyramid"]').click();
  await expect(draft.locator('.fd-svg svg')).toContainText('Randomize deney');
  await expect(draft.locator('[data-fd="hidden"]')).toContainText('1 öğe');
  // Yol haritasına geçince yedi öğe de görünür; içerik aynı.
  await draft.locator('[data-fd-type="roadmap"]').click();
  await expect(draft.locator('[data-fd="hidden"]')).toHaveCount(0);
  await expect(draft.locator('.fd-svg svg')).toContainText('Uzman görüşü');
  await expect(inputs).toHaveCount(7);
  // Sözdizimli şablonda ipucu.
  await draft.locator('[data-fd-type="concept"]').click();
  await expect(draft.locator('[data-fd="hint"]')).toContainText('->');
  await draft.locator('[data-fd-type="argument"]').click();
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveCount(1);
  await expect(doc(page).locator('figure')).toHaveAttribute('data-visual-state', /"type":"argument"/);

  // Grafik: yeni türler.
  await doc(page).getByText('Sonraki paragraf.').click();
  await page.locator('[data-action="write-chart"]').click();
  for (const ty of ['barh', 'ring', 'kpi']) await expect(draft.locator(`[data-fd-type="${ty}"]`)).toBeVisible();
  await draft.locator('[data-fd="chart-label"]').first().fill('Açık erişim');
  await draft.locator('[data-fd="chart-value"]').first().fill('39');
  await draft.locator('[data-fd-type="ring"]').click();
  await expect(draft.locator('.fd-svg svg')).toContainText('%39');
});

test('WO-033 renk teması: galeriden seçilir; fırça galeriyi açar; "bütün şekillere uygula" öteki şekli de boyar', async ({ page }) => {
  test.setTimeout(60_000);
  await seedDraft(page, '<p>Önce. Isı alınır. Su döner.</p><p>Arada. Bir. İki.</p><p>Sonra.</p>', 'Tema');
  await mockApi(page);
  await page.goto('/#/yaz');
  const draft = page.getByTestId('figure-draft');
  const addCycle = async (text) => {
    await doc(page).getByText(text).click();
    await page.locator('[data-action="write-figure"]').click();
    await draft.locator('[data-fd-type="cycle"]').click();
    await draft.locator('[data-action="fd-from-paragraph"]').click();
    await draft.locator('[data-action="fd-done"]').click();
    await expect(draft).toHaveCount(0);
  };
  await addCycle('Önce.');
  await addCycle('Arada.');
  await expect(doc(page).locator('figure')).toHaveCount(2);

  // Fırça: taslak alanı galeri açık gelir; küçük resimler şeklin kendisiyle çizilir.
  await doc(page).locator('figure').first().hover();
  await page.getByTestId('objbar').locator('[data-action="obj-theme"]').click();
  const themes = draft.locator('[data-fd="themes"]');
  await expect(themes).toBeVisible();
  await expect(themes.locator('[data-fd-theme]')).toHaveCount(21);
  await expect(themes.locator('[data-fd-theme="orman"] svg')).toHaveCount(1);
  await themes.locator('[data-fd-theme="orman"]').click();
  await expect(draft.locator('[data-fd-look="palette"]')).toHaveAttribute('data-value', 'orman');
  await expect(draft.locator('.fd-svg svg [stroke="#1E5128"]').first()).toBeVisible();

  // Bütün şekillere uygula → ikinci şekil de aynı temayla yeniden çizilir; içeriği aynı kalır.
  await draft.locator('[data-fd="apply-all"]').check();
  await draft.locator('[data-action="fd-done"]').click();
  const states = await doc(page).locator('figure').evaluateAll((els) => els.map((e) => JSON.parse(e.dataset.visualState).data.appearance?.palette));
  expect(states).toEqual(['orman', 'orman']);
  await expect(doc(page).locator('figure').nth(1).locator('svg')).toContainText('Bir');
  await expect(doc(page).locator('figure').nth(1).locator('svg [stroke="#1E5128"]').first()).toBeAttached();

  // Geri alınabilir: Ctrl+Z son yeniden çizimi (ikinci şekil) geri alır.
  await doc(page).getByText('Sonra.').click();
  await page.keyboard.press('Control+z');
  await expect.poll(() => doc(page).locator('figure').nth(1).evaluate((e) => JSON.parse(e.dataset.visualState).data.appearance?.palette ?? null)).toBe(null);
  await expect(doc(page).locator('figure')).toHaveCount(2);

  // Şablon şeridi seçili şablona kayar: şeridin sonlarındaki Venn düzenlemeye açılınca görünür.
  await doc(page).getByText('Sonra.').click();
  await page.locator('[data-action="write-figure"]').click();
  await draft.locator('[data-fd-type="venn"]').click();
  await draft.locator('[data-fd="item"]').nth(0).fill('Mühendislik: modelleme');
  await draft.locator('[data-fd="item"]').nth(1).fill('Tıp: tanı');
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveCount(3);
  await doc(page).locator('figure').nth(2).dblclick();
  await expect.poll(() => draft.locator('.fd-types').evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(draft.locator('[data-fd-type="venn"]')).toBeInViewport();
});

test('katmanlı liste: minik ↳ ile alt öğe (1.1, 1.1.1), Tab/Shift+Tab, kök etiketi, ağaç iç içe çizer; şablon değişince katman korunur', async ({ page }) => {
  await seedDraft(page, '<p>Yöntem.</p>', 'Katman');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Yöntem.').click();
  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  await draft.locator('[data-fd-type="tree"]').click();
  const it = draft.locator('[data-fd="item"]');
  await it.nth(0).fill('Yöntemler');
  await it.nth(1).fill('Nicel');
  await it.nth(2).fill('Nitel');
  await expect(draft.locator('.fd-row .fd-n').first()).toHaveText('Kök');
  // Nicel'in altına alt öğe, onun altına bir katman daha.
  await it.nth(1).hover();
  await draft.locator('[data-fd="add-child"]').nth(1).click();
  await it.nth(2).fill('Deney');
  await it.nth(2).hover();
  await draft.locator('[data-fd="add-child"]').nth(2).click();
  await it.nth(3).fill('Ön test');
  await expect(draft.locator('.fd-row .fd-n')).toHaveText(['Kök', '1', '1.1', '1.1.1', '2']);
  // Shift+Tab bir katman dışarı, Tab geri içeri.
  await it.nth(3).press('Shift+Tab');
  await expect(draft.locator('.fd-row .fd-n').nth(3)).toHaveText('1.2');
  await it.nth(3).press('Tab');
  await expect(draft.locator('.fd-row .fd-n').nth(3)).toHaveText('1.1.1');
  await expect(draft.locator('.fd-svg svg')).toContainText('Ön test');
  // Şablon değişince katmanlar korunur: zihin haritasında da "Ön test" var, liste numaraları aynı.
  await draft.locator('[data-fd-type="mind"]').click();
  await expect(draft.locator('.fd-svg svg')).toContainText('Ön test');
  await expect(draft.locator('.fd-row .fd-n').nth(3)).toHaveText('1.1.1');
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveAttribute('data-visual-state', /"levels":\[0,0,1,2,0\]/);
});

test('WO-035 büyük düzenleme: minik Düzenle, tutamaçla genişlik, Esc panele döner, belgede ve Word\'de aynı oran', async ({ page }) => {
  test.setTimeout(60_000);
  await seedDraft(page, '<p>Önce. Isı alınır. Su döner.</p><p>Sonra.</p>', 'Genişlik');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Önce.').click();
  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  await draft.locator('[data-action="fd-from-paragraph"]').click();
  await draft.locator('[data-fd="big-edit"]').click();
  await expect(draft.locator('[data-fd="big"]')).toBeVisible();
  // Tutamaç klavyeyle: 8 adım sola = %60.
  const handle = draft.locator('[data-fd="handle"]');
  await handle.focus();
  for (let i = 0; i < 8; i += 1) await handle.press('ArrowLeft');
  await expect(draft.locator('[data-fd="width"]')).toHaveValue('60');
  // Esc taslağı kapatmaz, panele döner; seçim kalır.
  await page.keyboard.press('Escape');
  await expect(draft.locator('[data-fd="big"]')).toHaveCount(0);
  await expect(draft).toBeVisible();
  await draft.locator('[data-fd="big-edit"]').click();
  await expect(draft.locator('[data-fd="width"]')).toHaveValue('60');
  await draft.locator('[data-fd="big-done"]').click();
  await draft.locator('[data-action="fd-done"]').click();
  const fig = doc(page).locator('figure');
  await expect(fig).toHaveAttribute('data-width', '60');
  await expect(fig).toHaveAttribute('style', /width:\s*60%/);

  // Word: 580 px sütunun %60'ı = 348 px → 348 × 9525 EMU.
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.getByRole('button', { name: /Word/ }).first().click(),
  ]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const xml = await zip.file('word/document.xml').async('string');
  expect(xml).toMatch(/<wp:extent cx="3314700"/);
});

test('punto kutusu: otomatik değer ipucu; yazılan punto kaydedilir ve düzenlemede geri gelir', async ({ page }) => {
  await seedDraft(page, '<p>Önce. Isı alınır. Su döner.</p>', 'Punto');
  await mockApi(page);
  await page.goto('/#/yaz');
  await doc(page).getByText('Önce.').click();
  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  await draft.locator('[data-action="fd-from-paragraph"]').click();
  await draft.locator('[data-fd="look"] summary').click();
  const pt = draft.locator('[data-fd="pt"]');
  await expect(pt).toHaveAttribute('placeholder', '8.5');
  await pt.fill('11');
  await draft.locator('[data-fd="big-edit"]').click();
  await expect(draft.locator('[data-fd="pt"]')).toHaveValue('11');
  await draft.locator('[data-fd="big-done"]').click();
  await draft.locator('[data-action="fd-done"]').click();
  await expect(doc(page).locator('figure')).toHaveAttribute('data-visual-state', /"textPt":11/);
  await doc(page).locator('figure').dblclick();
  await expect(draft.locator('[data-fd="pt"]')).toHaveValue('11');
});
