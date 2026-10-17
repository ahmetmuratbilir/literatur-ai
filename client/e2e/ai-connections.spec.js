import { test, expect } from '@playwright/test';
import { API, mockApi, SEARCH_RESULT } from './fixtures.js';

/**
 * WO-023 — kendi yapay zekâ anahtarın: ayarlar paneli ve "anahtarın
 * çalışmadı" bildirimi. Sunucu sahte; gerçek uçlar sunucu birim testlerinde
 * (server/tests/aiConnections.test.js).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const KEY_OK = 'sk-good-PLAINTEXT-123456abcd';
const KEY_BAD = 'sk-bad-PLAINTEXT-999999zzzz';

/** Sahte bağlantı ucu: geçerli anahtar "ok" ve etkin; diğeri "invalid", etkin değil. */
async function mockConnections(page, { enabled = true } = {}) {
  const state = { connections: [], posted: [] };
  const view = () => state.connections.map((c) => ({ ...c }));
  await page.route(`${API}/api/ai-connections**`, async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace('/api/ai-connections', '');
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (req.method() === 'GET') return json({ enabled, storage: 'memory', providers: ['deepseek', 'gemini', 'groq'], connections: view() });
    if (req.method() === 'POST' && path === '') {
      const { provider, key } = req.postDataJSON();
      state.posted.push(key);
      const status = key === KEY_OK ? 'ok' : 'invalid';
      if (status === 'ok') state.connections.forEach((c) => { c.active = false; });
      state.connections = state.connections.filter((c) => c.provider !== provider);
      state.connections.push({ provider, last4: key.slice(-4), active: status === 'ok', lastStatus: status, lastCheckedAt: '2026-10-17T18:00:00Z' });
      return json({ status, connections: view() });
    }
    if (req.method() === 'POST' && path === '/default') { state.connections.forEach((c) => { c.active = false; }); return json({ connections: view() }); }
    if (req.method() === 'DELETE') { state.connections = state.connections.filter((c) => `/${c.provider}` !== path); return json({ connections: view() }); }
    return json({ connections: view() });
  });
  return state;
}

test('panel raydan açılır; varsayılan Literatür AI; geçerli anahtar etkin olur, yalnız son 4 karakter görünür', async ({ page }) => {
  await mockApi(page);
  const api = await mockConnections(page);
  await page.goto('/');
  await page.locator('[data-action="nav-ai"]').click();
  const panel = page.getByTestId('ai-connections');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Literatür AI (varsayılan)');
  await expect(panel.locator('.ai-conn__row').first()).toContainText('Kullanılıyor');
  await expect(panel).toContainText('Geliştirme modu');

  const keyInput = panel.locator('[data-action="ai-key"]');
  await expect(keyInput).toHaveAttribute('type', 'password');
  await panel.locator('[data-action="ai-provider"]').selectOption('deepseek');
  await keyInput.fill(KEY_OK);
  await panel.locator('[data-action="ai-save"]').click();
  await expect(page.getByTestId('ai-conn-message')).toContainText('Anahtar çalışıyor');
  const row = panel.locator('[data-provider="deepseek"]');
  await expect(row).toContainText('••••abcd');
  await expect(row).toContainText('Kullanılıyor');
  await expect(keyInput).toHaveValue('');
  expect(await page.content()).not.toContain('PLAINTEXT');
  expect(api.posted).toEqual([KEY_OK]);

  await panel.locator('[data-action="ai-default"]').click();
  await expect(panel.locator('.ai-conn__row').first()).toContainText('Kullanılıyor');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('geçersiz anahtar kaydedilir ama kullanılmaz; durum "Anahtar geçersiz"', async ({ page }) => {
  await mockApi(page);
  await mockConnections(page);
  await page.goto('/');
  await page.locator('[data-action="nav-ai"]').click();
  const panel = page.getByTestId('ai-connections');
  await panel.locator('[data-action="ai-provider"]').selectOption('groq');
  await panel.locator('[data-action="ai-key"]').fill(KEY_BAD);
  await panel.locator('[data-action="ai-save"]').click();
  await expect(page.getByTestId('ai-conn-message')).toContainText('reddetti');
  const row = panel.locator('[data-provider="groq"]');
  await expect(row).toContainText('Anahtar geçersiz');
  await expect(row.locator('[data-action="ai-activate"]')).toBeVisible();
  await expect(panel.locator('.ai-conn__row').first()).toContainText('Kullanılıyor');
});

test('sunucuda kapalıyken panel bunu söyler, form yok', async ({ page }) => {
  await mockApi(page);
  await mockConnections(page, { enabled: false });
  await page.goto('/');
  await page.locator('[data-action="nav-ai"]').click();
  await expect(page.getByTestId('ai-conn-disabled')).toBeVisible();
  await expect(page.locator('[data-action="ai-key"]')).toHaveCount(0);
});

test('kendi anahtarın çalışmayınca bildirim çıkar; "Bağlantıları aç" paneli açar', async ({ page }) => {
  await mockApi(page);
  await mockConnections(page);
  await page.route(`${API}/api/search**`, (route) => route.fulfill({
    json: SEARCH_RESULT,
    headers: { 'X-AI-Key-Status': 'invalid', 'Access-Control-Expose-Headers': 'X-AI-Key-Status' },
  }));
  await page.goto('/');
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  const toast = page.locator('.ui-toast', { hasText: 'Kendi yapay zekâ anahtarın çalışmadı' });
  await expect(toast).toBeVisible();
  await toast.locator('[data-action="toast-action"]').click();
  await expect(page.getByTestId('ai-connections')).toBeVisible();
});
