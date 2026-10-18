import { test, expect } from '@playwright/test';
import { API, mockApi, seedDraft } from './fixtures.js';

/**
 * WO-024 — yardım ve destek, ilk giriş tanışma soruları, ipucu katmanı,
 * kopyalanamayan BibTeX'in indirilmesi, hata sınırı, yazım yüzeyi açıkken
 * arka planın klavyeye kapanması ve "Atıf ekle" yönlendirmesi.
 * Sunucu sahte (fixtures.js); yeni uçlar burada ayrıca cevaplanır.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

test('yardım ve destek: kenar çubuğundan açılır, kısa mesajı reddeder, geri bildirimi gönderir', async ({ page }) => {
  await mockApi(page);
  const sent = [];
  await page.route(`${API}/api/feedback`, async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, saved: true, emailed: true }) });
  });
  await page.goto('/');
  await page.locator('[data-action="nav-help"]').click();
  const dialog = page.getByTestId('help-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Yardım ve destek' })).toBeVisible();

  // Satır içi yardım önce: kısa cevaplar açılır.
  await dialog.getByText('Sonuçlar neden bu sırada?').click();
  await expect(dialog.getByText(/AHP ağırlıklarıyla toplanır/)).toBeVisible();

  // Kısa mesaj: gönderilmez, alanın yanında hata, odak alanda.
  await dialog.getByText('Hata', { exact: true }).click();
  await dialog.locator('[data-action="help-message"]').fill('kısa');
  await dialog.locator('[data-action="help-send"]').click();
  await expect(dialog.getByRole('alert')).toContainText('en az 10 karakter');
  expect(sent).toHaveLength(0);

  await dialog.locator('[data-action="help-message"]').fill('Sepete ekle düğmesine bastım, makale görünmedi.');
  await dialog.locator('[data-action="help-contact"]').uncheck();
  await dialog.locator('[data-action="help-send"]').click();
  await expect(dialog.getByText('Teşekkürler, mesajın ekibe ulaştı.')).toBeVisible();
  expect(sent).toEqual([{ kind: 'hata', message: 'Sepete ekle düğmesine bastım, makale görünmedi.', page: 'search', contactOk: false }]);

  await dialog.locator('[data-action="help-done"]').click();
  await expect(dialog).toBeHidden();
});

test('yardım: gönderilemezse doğrudan e-posta yolu gösterilir; Esc kapatır ve odak geri döner', async ({ page }) => {
  await mockApi(page);
  await page.route(`${API}/api/feedback`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/');
  const opener = page.locator('[data-action="nav-help"]');
  await opener.click();
  const dialog = page.getByTestId('help-dialog');
  await dialog.locator('[data-action="help-message"]').fill('Türkçe tezler aramada nasıl çıkıyor?');
  await dialog.locator('[data-action="help-send"]').click();
  await expect(dialog.getByRole('link', { name: 'info@literatur-ai.com' })).toHaveAttribute('href', /^mailto:info@literatur-ai\.com/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('tanışma: sunucu "sor" derse açılır, eksik cevapta uyarır, cevapları kaydeder ve oturumda bir daha sormaz', async ({ page }) => {
  await mockApi(page);
  const posts = [];
  await page.route(`${API}/api/me/onboarding`, async (route) => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"needed":true}' });
  });
  await page.goto('/');
  const dialog = page.getByTestId('onboarding-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-action="onboarding-save"]').click();
  await expect(dialog.getByText('Bir seçenek işaretle.')).toBeVisible();
  await expect(dialog.getByText('En az bir amaç işaretle.')).toBeVisible();
  expect(posts).toHaveLength(0);

  await dialog.getByText('Doktora', { exact: true }).click();
  for (const p of ['Tez', 'Makale', 'Literatür taraması']) await dialog.getByText(p, { exact: true }).click();
  // Dördüncü amaç seçilemez (en fazla 3).
  await dialog.getByText('Proje başvurusu', { exact: true }).click();
  await dialog.getByText('Hocam / arkadaşım', { exact: true }).click();
  await dialog.locator('[data-action="onboarding-save"]').click();
  await expect(dialog).toBeHidden();
  expect(posts).toEqual([{ role: 'doktora', purpose: ['tez', 'makale', 'literatur-taramasi'], source: 'hoca-arkadas' }]);

  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('onboarding-dialog')).toHaveCount(0);
});

test('tanışma: sunucu sormazsa hiç açılmaz', async ({ page }) => {
  await mockApi(page);
  await page.route(`${API}/api/me/onboarding`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"needed":false}' }));
  await page.goto('/');
  await page.waitForTimeout(800);
  await expect(page.getByTestId('onboarding-dialog')).toHaveCount(0);
});

test('ipucu: simge düğmesinde üzerine gelince ve klavye odağında ürünün ipucu çıkar; title geri konur', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  // Kenar çubuğu kapalı açılır: raydaki simge düğmeleri.
  const toggle = page.getByRole('button', { name: 'Kenar çubuğunu genişlet' });
  await toggle.hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toHaveText('Kenar çubuğunu genişlet');
  await page.mouse.move(700, 700);
  await expect(tip).toHaveCount(0);
  await expect(toggle).toHaveAttribute('title', 'Kenar çubuğunu genişlet');

  // Klavye: odaklanınca da çıkar, ekran okuyucuya bağlanır, Esc kapatır.
  const fav = page.getByRole('button', { name: 'Favoriler' });
  await fav.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(tip).toHaveText('Favoriler');
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);
});

test('BibTeX: pano izni yoksa kayıt .bib dosyası olarak iner ve düğme söyler', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('izin yok')) }, configurable: true });
    document.execCommand = () => false;
  });
  await page.goto('/');
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  const bib = page.getByRole('button', { name: 'BibTeX', exact: true }).first();
  const download = page.waitForEvent('download');
  await bib.click();
  expect((await download).suggestedFilename()).toMatch(/\.bib$/);
  await expect(page.getByRole('button', { name: 'İndirildi' }).first()).toBeVisible();
});

test('hata sınırı: yapay zekâ bağlantıları bozuk yanıt alsa da uygulama ayakta kalır', async ({ page }) => {
  await mockApi(page);
  // Yanlış yapılandırılmış API adresinde Vercel'in döndürdüğü gibi: JSON yerine sayfa.
  await page.route(`${API}/api/ai-connections**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }));
  await page.goto('/');
  await page.locator('[data-action="nav-ai"]').click();
  await expect(page.locator('[data-action="nav-research"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Yapay zekâ bağlantıları' })).toBeVisible();
});

test('yazım yüzeyi açıkken arkadaki araştırma görünümü klavyeyle erişilemez; "Atıf ekle" imleç yoksa yönlendirir', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Pasif sistemler çalışır.</p><h1>Kaynakça</h1>', 'Yönlendirme taslağı');
  await mockApi(page, { basket: [{ _id: 'b1', title: 'Doğal dolaşım deneyleri', creator: 'Zeynep Kaya', year: 2020, doi: '10.1/kaya' }] });
  await page.goto('/#/yaz');
  await expect(page.locator('main.app-main')).toHaveAttribute('inert', '');
  await page.locator('[data-action="write-cite"]').first().click();
  await expect(page.getByTestId('write-hint')).toContainText('Atıfın gireceği yere belgede tıkla');
});
