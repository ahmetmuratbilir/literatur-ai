import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';
import fs from 'node:fs';

/**
 * WO-010 Aşama 1 — Yazım Stüdyosu yerleşimi: belge yapısı, sağ panel
 * sekmeleri, yer kuralı, ölçek, atıf ekleme ve seçim araç çubuğu.
 */

const SOURCE = {
  _id: 'b1',
  title: 'Passive decay heat removal in integral test facilities',
  creator: 'Li Chen, Hui Wang',
  year: 2021,
  doi: '10.1016/j.nucengdes.2021.110950',
  description: 'Passive decay heat removal was maintained for 72 hours without AC power.',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
  });
  // Geliştirme şeridi sağ altta durum çubuğunu örtüyor; testte kapatılır.
  await page.addInitScript(() => {
    // Geliştirme şeridi durum çubuğunu örtüyor. React'in düğümüne dokunmadan, yalnız stille gizlenir
    // (düğümü silmek React güncellemelerini ara sıra bozuyordu: kayıt testi kararsızdı).
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const outline = (page) => page.locator('.wx-nav');

/** Taslak yokken yazar modu önce biçim sorar (WO-011); varsayılan biçimle başlatır. */
async function startDraft(page) {
  await page.locator('[data-action="format-confirm"]').click();
  await expect(page.locator('.wx-page')).toBeVisible();
}
const side = (page) => page.locator('.wx-side');

test('belge yapısı araç çubuğundaki düğmeyle gizlenip açılıyor; iç ray yok', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p><h2>Amaç</h2><p>Daha fazla metin.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await expect(page.locator('.wx-rail')).toHaveCount(0);
  await expect(outline(page)).toBeVisible();
  await expect(outline(page).getByRole('button', { name: /Amaç/ })).toBeVisible();
  await page.locator('[data-action="write-outline"]').click();
  await expect(outline(page)).toHaveCount(0);
  await page.locator('[data-action="write-outline"]').click();
  await expect(outline(page)).toBeVisible();
});

test('sağ panel üç sekme: Kanıt, Kaynaklar, Kaynakça', async ({ page }) => {
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yaz');
  await startDraft(page);
  await expect(side(page)).toBeVisible();
  await page.locator('[data-action="side-sources"]').click();
  await expect(side(page).getByText(SOURCE.title)).toBeVisible();
  await page.locator('[data-action="side-source-open"]').click();
  // Kaynağa tıklamak Kanıt sekmesine geçer: pasaj ve üretim düğmesi orada
  await expect(page.locator('[data-action="side-evidence"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(side(page).getByText('72 hours without AC power')).toBeVisible();
  await page.locator('[data-action="side-bib"]').click();
  await expect(side(page).getByRole('region', { name: 'Kaynakça' })).toBeVisible();
});

test('1440×900 Teslim görünümü: sağ panel açıkken A4 %100, sığmayınca belge yapısı kapanır (Faz 2)', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await expect(outline(page)).toBeVisible();
  await page.locator('[data-action="write-view-submit"]').click();
  await expect(side(page)).toBeVisible();
  await expect(outline(page)).toHaveCount(0);
  await expect(page.locator('[data-action="write-zoom-actual"]')).toHaveAttribute('aria-pressed', 'true');
  const width = await page.locator('.wx-page').evaluate((el) => el.getBoundingClientRect().width);
  expect(Math.abs(width - 793.7)).toBeLessThan(2);
  // Sayfa görünür alanda: sağ kenarı panelin solunda.
  const pageRight = await page.locator('.wx-page').evaluate((el) => el.getBoundingClientRect().right);
  const sideLeft = await side(page).evaluate((el) => el.getBoundingClientRect().left);
  expect(pageRight).toBeLessThanOrEqual(sideLeft);
  // Durum çubuğu tek satır ve sayfa numarası "yaklaşık".
  await expect(page.getByTestId('page-of')).toContainText('yaklaşık');
  const statusHeight = await page.locator('.wx-status').evaluate((el) => el.getBoundingClientRect().height);
  expect(statusHeight).toBeLessThan(44);
});

test('Taslak görünümünde yer yeterliyse belge yapısı açık kalır', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await page.locator('[data-action="write-view-draft"]').click();
  await page.locator('[data-action="write-side"]').click();
  await page.locator('[data-action="write-side"]').click();
  await expect(side(page)).toBeVisible();
  await expect(outline(page)).toBeVisible();
});

test('sığdır sayfayı küçültür, gerçek boyut A4\'ü 1:1 gösterir', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await page.locator('[data-action="write-view-submit"]').click();
  // Varsayılan %100. Kullanıcı belge yapısını kendisi açarsa kapatılmaz; o zaman sığmaz.
  await expect(page.locator('[data-action="write-zoom-actual"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="write-outline"]').click();
  await expect(outline(page)).toBeVisible();
  const actualWidth = await page.locator('.wx-page').evaluate((el) => el.getBoundingClientRect().width);
  await page.locator('[data-action="write-zoom-fit"]').click();
  // Ölçekte yüzde gösterilmez (Faz 2).
  await expect(page.locator('[data-action="write-zoom-fit"]')).not.toContainText('%');
  const fitWidth = await page.locator('.wx-page').evaluate((el) => el.getBoundingClientRect().width);
  expect(fitWidth).toBeLessThan(actualWidth);
  // A4 = 210 mm = 793.7 CSS px
  expect(Math.abs(actualWidth - 793.7)).toBeLessThan(2);
});

test('"Atıf ekle" seçili kaynağın atfını imlece koyar; kaynak yoksa Kaynaklar sekmesini açar', async ({ page }) => {
  await seedDraft(page, '<p>Pasif sistemler harici güç olmadan çalışır.</p>');
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yaz');
  const doc = page.locator('.wx-page');
  // Henüz kaynak seçili değil: düğme kaynak listesine götürür
  await page.locator('[data-action="write-side"]').click();
  await page.locator('[data-action="write-side"]').click();
  await doc.click();
  await page.keyboard.press('End');
  // Kaynak seçimi: Kaynaklar sekmesinden
  await page.locator('[data-action="side-sources"]').click();
  await page.locator('[data-action="side-source-open"]').click();
  await doc.click();
  await page.keyboard.press('End');
  await page.locator('[data-action="write-cite"]').click();
  // Atfın biçimi citation.js'in işi (birim testli); burada yalnız imlecin yerine girdiği.
  await expect(doc).toContainText(/çalışır\. \(Chen[^)]*, 2021\)/);
});

test('seçim araç çubuğu: seçince çıkar, iddia kararını çevirir', async ({ page }) => {
  await seedDraft(page, '<p>Pasif sistemler kaza riskini azaltır.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  const doc = page.locator('.wx-page p').first();
  // Paragrafın ortası boş alan olabilir; üç tık satırı seçer.
  await doc.click({ clickCount: 3 });
  await expect(page.locator('.wx-selbar')).toBeVisible();
  // Sayaçlar Kontrol sekmesinde (Faz 2).
  await page.locator('[data-action="side-check"]').click();
  await doc.click({ clickCount: 3 });
  const notClaimBefore = await page.locator('.wx-stat--plain').innerText();
  await page.locator('[data-action="selbar-claim"]').click();
  await expect(page.locator('.wx-stat--plain')).not.toHaveText(notClaimBefore);
  // Seçim kalkınca çubuk kaybolur
  await page.keyboard.press('End');
  await expect(page.locator('.wx-selbar')).toHaveCount(0);
});

test('yeni düğmelerin envanteri', async ({ page }) => {
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yaz');
  await startDraft(page);
  for (const id of ['write-outline', 'write-cite', 'write-more', 'write-side', 'write-format', 'write-view-draft', 'write-view-submit',
    'side-evidence', 'side-sources', 'side-bib']) {
    await expect(page.locator(`[data-action="${id}"]`).first(), id).toBeAttached();
  }
});

// --- WO-011 Faz 2: belge yapısı ---------------------------------------------

const OUTLINE_DOC = '<h1>Giriş</h1><p>Giriş metni.</p><h1>Kuram</h1><h2>Alt A</h2><p>A metni.</p><h2>Alt B</h2><p>B metni.</p><h1>Kaynakça</h1>';
const headingTexts = (page) => page.locator('.wx-page').locator('h1, h2, h3').allInnerTexts();

test('belge yapısı numaralı ve iç içe; katlanır, tıklayınca bölüme gider', async ({ page }) => {
  await seedDraft(page, OUTLINE_DOC);
  await mockApi(page);
  await page.goto('/#/yaz');
  const nav = outline(page);
  await expect(nav.locator('.wx-ol__num')).toHaveText(['1', '2', '2.1', '2.2', '3']);
  await nav.locator('.wx-ol').nth(1).locator('.wx-ol__fold').click();
  await expect(nav.locator('.wx-ol')).toHaveCount(3);
  await nav.locator('.wx-ol').nth(1).locator('.wx-ol__fold').click();
  await nav.getByRole('button', { name: /Alt B/ }).click();
  await expect.poll(() => page.evaluate(() => {
    const node = window.getSelection().anchorNode;
    return (node?.nodeType === 3 ? node.parentElement : node)?.closest('h2')?.textContent || '';
  })).toBe('Alt B');
});

test('belge yapısı: yeniden adlandır, taşı ve bölüm ekle; metin kaybolmaz', async ({ page }) => {
  await seedDraft(page, OUTLINE_DOC);
  await mockApi(page);
  await page.goto('/#/yaz');
  const nav = outline(page);
  // Yeniden adlandır
  await nav.locator('.wx-ol').nth(3).hover();
  await nav.locator('.wx-ol').nth(3).locator('[data-action="outline-rename"]').click();
  await nav.locator('[data-action="outline-rename-input"]').fill('Alt B yeni');
  await page.keyboard.press('Enter');
  await expect.poll(() => headingTexts(page)).toEqual(['Giriş', 'Kuram', 'Alt A', 'Alt B yeni', 'Kaynakça']);
  // Alt B'yi yukarı taşı: içeriğiyle birlikte Alt A'nın önüne
  await nav.locator('.wx-ol').nth(3).hover();
  await nav.locator('.wx-ol').nth(3).locator('[data-action="outline-up"]').click();
  await expect.poll(() => headingTexts(page)).toEqual(['Giriş', 'Kuram', 'Alt B yeni', 'Alt A', 'Kaynakça']);
  const text = await page.locator('.wx-page').innerText();
  expect(text.indexOf('B metni.')).toBeLessThan(text.indexOf('A metni.'));
  // Alt bölüm üst bölümden çıkmaz: Alt B artık ilk alt bölüm, yukarı taşınamaz
  await nav.locator('.wx-ol').nth(2).hover();
  await nav.locator('.wx-ol').nth(2).locator('[data-action="outline-up"]').click();
  await expect.poll(() => headingTexts(page)).toEqual(['Giriş', 'Kuram', 'Alt B yeni', 'Alt A', 'Kaynakça']);
  // Kuram'ı (alt bölümleriyle) sürükleyip Giriş'in önüne bırak
  await nav.locator('.wx-ol').nth(1).dragTo(nav.locator('.wx-ol').nth(0));
  await expect.poll(() => headingTexts(page)).toEqual(['Kuram', 'Alt B yeni', 'Alt A', 'Giriş', 'Kaynakça']);
  // Bölüm ekle: Kaynakça'dan önce, adı düzenlenebilir
  await nav.locator('[data-action="outline-add"]').click();
  await nav.locator('[data-action="outline-rename-input"]').fill('Sonuç');
  await page.keyboard.press('Enter');
  await expect.poll(() => headingTexts(page)).toEqual(['Kuram', 'Alt B yeni', 'Alt A', 'Giriş', 'Sonuç', 'Kaynakça']);
  for (const t of ['Giriş metni.', 'A metni.', 'B metni.']) await expect(page.locator('.wx-page')).toContainText(t);
});

test('belge yapısı: tablo ve şekil başlıkları listelenir, boşken açıklama', async ({ page }) => {
  await seedDraft(page, '<h1>Bulgular</h1><p>Tablo 1. Koşullar</p><p>Şekil 1: Düzenek</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await expect(outline(page).locator('[data-action="outline-caption"]')).toHaveText(['Tablo 1. Koşullar', 'Şekil 1: Düzenek']);
  // Hedefsiz bölümde kelime sayısı gösterilmez (yalnız şablon hedefi varsa).
  await expect(outline(page).locator('.wx-ol__count')).toHaveCount(0);
});

test('araç çubuğu tek satır; dar ekranda gruplar "Daha fazla"ya geçer (Faz 2)', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Su H2O formülüyle yazılır.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  const ribbon = page.locator('.wx-ribbon');
  // Belge yapısı ve sağ panel kapalıyken 1440 px'te yazı tipi grubu çubukta.
  await page.locator('[data-action="write-outline"]').click();
  await page.locator('[data-action="write-side"]').click();
  await expect(ribbon.locator('[data-action="write-line-height"]')).toBeVisible();
  for (const width of [1440, 1100, 900, 700]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(200);
    const h = await ribbon.evaluate((el) => el.getBoundingClientRect().height);
    expect(h, `${width} px`).toBeLessThan(52);
  }
  // 700 px: yazı tipi grubu çubuktan kalkar, "Daha fazla" içinde görünür.
  await expect(ribbon.locator('> [data-action="write-font"], > select[data-action="write-font"]')).toHaveCount(0);
  // Dar ekranda sağ panel belgenin üstünü örter; kapatılır.
  if (await side(page).count()) await page.locator('[data-action="write-side"]').click();
  await page.locator('[data-action="write-more"]').click();
  await expect(page.locator('.wx-more [data-group="fonts"] [data-action="write-font"]')).toBeInViewport();
  // Üst simge seçili metne uygulanır.
  await page.locator('.wx-page p').first().evaluate((el) => {
    const r = document.createRange();
    const text = el.firstChild;
    r.setStart(text, text.textContent.indexOf('2'));
    r.setEnd(text, text.textContent.indexOf('2') + 1);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  });
  await page.getByRole('button', { name: 'Alt simge' }).click();
  await expect(page.locator('.wx-page sub')).toHaveText('2');
});

test('A4 sayfa: Ekle ile numaralı tablo başlığı, Teslim\'de sayfa numarası, atıfa tıklayınca kaynak, DOCX alt bilgisi (Faz 2)', async ({ page }) => {
  await seedDraft(page, '<h1>Bulgular</h1><p>Isı tahliyesi sürdü (Chen &amp; Wang, 2021).</p><p>Tablo 1. Koşullar</p>');
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yaz');
  // Ekle › Tablo başlığı: sıradaki numara
  await page.locator('.wx-page p').first().click();
  await page.locator('[data-action="write-insert"]').click();
  await page.locator('[data-action="insert-table-caption"]').click();
  await expect(page.locator('.wx-page')).toContainText('Tablo 2.');
  await expect(outline(page).locator('[data-action="outline-caption"]')).toHaveCount(2);
  // Atfa tıklayınca kaynak sağ panelde açılır
  await page.locator('[data-action="side-sources"]').click();
  const citeBox = await page.locator('.wx-page p').first().evaluate((el) => {
    const text = el.firstChild;
    const i = text.textContent.indexOf('(Chen');
    const r = document.createRange();
    r.setStart(text, i + 3);
    r.setEnd(text, i + 4);
    const b = r.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  });
  await page.mouse.click(citeBox.x, citeBox.y);
  await expect(page.locator('[data-action="side-evidence"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(side(page)).toContainText(SOURCE.title);
  // Teslim önizlemesinde sayfa numarası
  await page.locator('[data-action="write-view-submit"]').click();
  await expect(page.getByTestId('page-number').first()).toHaveText('Sayfa 1 / 1');
  // DOCX'te alt bilgi (sayfa numarası) bölümü var
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Word/ }).first().click()]);
  const bytes = fs.readFileSync(await download.path()).toString('latin1');
  expect(bytes).toContain('word/footer1.xml');
});

// --- WO-011 Faz 2 adım 5: seçim menüsü, Asistan --------------------------------
// Sahte: /api/language-edit cevabı (gerçek uç sunucu birim testleriyle ve bir canlı çağrıyla denendi).

const ASSIST_DOC = '<h1>Giriş</h1><p>Pasif sistem guvenlidir ve kaza riskini azaltir (Chen &amp; Wang, 2021). Bu cumle secilmeyecek.</p><p>İkinci paragraf aynen kalmalı.</p>';

async function selectInFirstParagraph(page, from, to) {
  await page.locator('.wx-page p').first().evaluate((el, [a, b]) => {
    const text = el.firstChild;
    const r = document.createRange();
    r.setStart(text, text.textContent.indexOf(a));
    r.setEnd(text, text.textContent.indexOf(b) + b.length);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }, [from, to]);
}

test('seçim menüsü: AI yalnız iki eylem; Atıf doğrula ve Yorum "Yakında"; panel dört sekme', async ({ page }) => {
  await seedDraft(page, ASSIST_DOC);
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yaz');
  // Görsel sekmesi WO-019 ile eklendi (VISUALS_ENABLED).
  await expect(side(page).locator('.wx-panel-head [role="group"] > button')).toHaveText([/Kaynaklar/, 'Asistan', /Kontrol/, 'Görsel']);
  await page.locator('.wx-page p').first().click({ clickCount: 3 });
  await expect(page.locator('.wx-selbar')).toBeVisible();
  await expect(page.locator('[data-action="selbar-verify"]')).toBeDisabled();
  await expect(page.locator('[data-action="selbar-comment"]')).toBeDisabled();
  await expect(page.locator('[data-action="selbar-verify"]')).toContainText('Yakında');
  await page.locator('[data-action="selbar-ai"]').click();
  await expect(page.locator('.wx-selbar__menu [role="menuitem"]')).toHaveText(['Dil ve anlatımı düzelt', 'Kaynak ihtiyacını değerlendir']);
});

test('Dil ve anlatımı düzelt: öneri karşılaştırmalı; Uygula yalnız seçimi değiştirir, Geri al döndürür', async ({ page }) => {
  await seedDraft(page, ASSIST_DOC);
  await mockApi(page, { basket: [SOURCE] });
  let sent = '';
  await page.route('http://localhost:3000/api/language-edit', async (route) => {
    sent = route.request().postDataJSON().text;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'ok', revised: 'Pasif sistem güvenlidir ve kaza riskini azaltır (Chen & Wang, 2021).', notes: ['Yazım düzeltildi'], model: 'sahte', promptVersion: 'PR11.v1' }) });
  });
  await page.goto('/#/yaz');
  const before = await page.locator('.wx-page').innerText();
  await selectInFirstParagraph(page, 'Pasif', '2021).');
  await expect(page.locator('.wx-selbar')).toBeVisible();
  await page.locator('[data-action="selbar-ai"]').click();
  await page.locator('[data-action="selbar-ai-language"]').click();
  await expect(page.getByTestId('assist-suggestion')).toBeVisible();
  expect(sent).toBe('Pasif sistem guvenlidir ve kaza riskini azaltir (Chen & Wang, 2021).');
  // Uygulanmadan belge değişmez.
  expect(await page.locator('.wx-page').innerText()).toBe(before);
  await page.locator('[data-action="assist-apply"]').click();
  await expect(page.locator('.wx-page p').first()).toHaveText('Pasif sistem güvenlidir ve kaza riskini azaltır (Chen & Wang, 2021). Bu cumle secilmeyecek.');
  await expect(page.locator('.wx-page p').nth(1)).toHaveText('İkinci paragraf aynen kalmalı.');
  await page.locator('[data-action="assist-undo"]').click();
  await expect.poll(() => page.locator('.wx-page').innerText()).toBe(before);
});

test('Reddet belgeyi değiştirmez; kurallara takılan öneri gösterilmez', async ({ page }) => {
  await seedDraft(page, ASSIST_DOC);
  await mockApi(page, { basket: [SOURCE] });
  let answer = { status: 'ok', revised: 'İkinci paragraf aynen kalmalıdır.', notes: [], model: 'sahte', promptVersion: 'PR11.v1' };
  await page.route('http://localhost:3000/api/language-edit', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(answer) }));
  await page.goto('/#/yaz');
  const before = await page.locator('.wx-page').innerText();
  await page.locator('.wx-page p').nth(1).click();
  await page.locator('[data-action="side-assistant"]').click();
  await page.locator('[data-action="assist-language"]').click();
  await page.locator('[data-action="assist-reject"]').click();
  expect(await page.locator('.wx-page').innerText()).toBe(before);
  answer = { status: 'rejected', reason: 'citations' };
  await page.locator('.wx-page p').nth(1).click();
  await page.locator('[data-action="assist-language"]').click();
  await expect(page.getByTestId('assist-rejected')).toContainText('atıfları korumadı');
  await expect(page.locator('[data-action="assist-apply"]')).toHaveCount(0);
});

test('Kaynak ihtiyacını değerlendir: kural tabanlı, modelsiz; cümle bazında karar', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Pasif sistemler kaza riskini yüzde doksan azaltır. Isı tahliyesi sürdü (Chen &amp; Wang, 2021).</p>');
  await mockApi(page, { basket: [SOURCE] });
  let calls = 0;
  await page.route('http://localhost:3000/api/language-edit', (route) => { calls += 1; return route.fulfill({ body: '{}' }); });
  await page.goto('/#/yaz');
  await page.locator('.wx-page p').first().click();
  await page.locator('[data-action="side-assistant"]').click();
  await page.locator('[data-action="assist-need"]').click();
  const need = page.getByTestId('assist-need');
  await expect(need.locator('[data-mark="uncited"]')).toContainText('Kaynak gerekli');
  await expect(need.locator('[data-mark="cited"]')).toContainText('Atıf işareti var');
  await expect(need).toContainText('model kullanılmadı');
  expect(calls).toBe(0);
});

test('yazar modunda yüzde ya da skor gösterilmez (Faz 2)', async ({ page }) => {
  await seedDraft(page, ASSIST_DOC);
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yaz');
  for (const view of ['write-view-draft', 'write-view-submit']) {
    await page.locator(`[data-action="${view}"]`).click();
    for (const tab of ['side-sources', 'side-assistant', 'side-check']) {
      await page.locator(`[data-action="${tab}"]`).click();
      const text = await page.locator('.wx-shell').innerText();
      const chrome = text.replace(await page.locator('.wx-page').innerText(), '');
      expect(chrome, `${view} ${tab}`).not.toMatch(/%\s*\d|\d\s*%|skor|güven puanı|doğruluk/i);
    }
  }
});
