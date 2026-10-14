import { defineConfig, devices } from '@playwright/test';

/**
 * Tarayıcıda gezinme testleri (WO-010 Döngü B).
 *
 * Sunucu çağrıları testin içinde sahte cevaplanıyor (`e2e/fixtures.js`):
 * testler dış kaynaklara, veritabanına ve model sağlayıcısına bağlı değil,
 * her koşumda aynı sonucu veriyor. Clerk anahtarı yokken uygulama geliştirme
 * kimliğiyle açılıyor (`auth/clerkBridge.js`).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'tr-TR',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
