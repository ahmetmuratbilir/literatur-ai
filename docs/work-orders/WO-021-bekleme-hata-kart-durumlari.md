# WO-021 — Bekleme, hata ve kart durumları

| Alan | Değer |
| --- | --- |
| Durum | Taslak (17.10.2026) |
| Kapsam | Çapraz (istemci; sunucuda yanıta kaynak durumu) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2 oturum |
| Ön koşul | WO-018 (ortak pencere, bildirim) bitti |
| Yol haritası aşaması | P1 — `docs/design/yol-haritasi.md` adım 7 |
| Dal | `wo-021-durumlar`, WO-018 ucundan |
| Kaynak | Planlardaki adı WO-E2. `docs/design/etkilesim-ve-durumlar-plani.md` §3–§5, §7; prototip `docs/design/mockup-durumlar.html` (40 kontrol geçti) |

## Problem
- Arama bekleme ekranı tüzük 2.8'e aykırı: aşama metni 2 sn'lik
  zamanlayıcıyla dönüyor, gerçek ilerlemeyle bağı yok ve liste bitince başa
  dönüyor (`client/src/App.jsx:397-404`); sabit "9 Açık Kaynak" yazıyor
  (`App.jsx:979-986`, `wo-008-sekil-gomme` ucunda 17.10.2026'da doğrulandı).
- Hata tek tip genel kutu (`App.jsx:1151-1158`); kısmi başarısızlık
  gösterilmiyor (planın §0.4).
- Kart durumları (eksik bilgi, geri çekilmiş, zenginleştirme düştü …) tek
  tek tasarlanmamış.

## Neden şimdi
Kullanıcıya yanlış bilgi veren tek ekran bu (sahte ilerleme). Tüzüğün
dürüstlük kuralını en çok gören yer.

## Kapsam
### Dahil
- **Faz 0 — envanter (salt okunur):** §0.5'in açık maddeleri: `/api/search`
  yanıtında kaynak bazlı durum var mı (`stageResult.js`), arama süresi p50/p95
  (yerelde 20 sorgu), `ResultCard.jsx` durumları, Kademe 2 kaynakların canlı
  aramada çağrılıp çağrılmadığı (2.7 notu; düzeltme kapsam dışı, raporlanır).
- **Faz 1 — bekleme (A yolu):** §3.1 süre kuralları; iskelet + gerçek süre +
  İptal (`AbortController`); 20 sn uyarısı; sonuç başlığında taranan ve yanıt
  vermeyen kaynaklar (sayı yanıttan gelir, sabit yazılmaz).
- **Faz 2 — hatalar:** §5.1'in 10 sınıfı; `role="alert"` / `status`; teknik
  ayrıntı katlanır; 429'da geri sayım.
- **Faz 3 — kart durumları:** prototipteki matris: sonuç kartı, kaynak
  satırı, taslak kartı, analiz sonucu. Kanıt kartı WO-005 gelince (bugün kod
  yok).

### Hariç
- B yolu (SSE ile gerçek ilerleme) — ayrı karar (planlardaki WO-E3).
- `@axe-core/playwright` — yeni bağımlılık, ayrı onay.

## Dokunulabilecek dosyalar
- `client/src/App.jsx` (bekleme ve hata bölgeleri), `client/src/components/ResultCard.jsx`
- `client/src/components/states/` (yeni: `SearchWaiting.jsx`, `ErrorNotice.jsx`, `errorClass.js`)
- `client/src/hooks/useBasket.js`, `client/src/components/workspace/*` (yalnız taslak/analiz kart durumları)
- `server/services/search.js`, `server/services/stageResult.js` (yalnız yanıta kaynak durumu eklemek; Faz 0 gerekli görürse)
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`, `client/src/styles/states.css`
- `client/tests/errorClass.test.js` (yeni), `client/e2e/states.spec.js` (yeni), ilgili sunucu testi
- `docs/work-orders/README.md`, `docs/design/etkilesim-ve-durumlar-plani.md` (§0.5 sonuçları), bu dosya

## Yaklaşım
Prototip davranışı birebir; `errorClass.js` saf (HTTP durumu, ağ hatası,
süre → sınıf), birim testli. Sunucu değişikliği yalnız Faz 0 kaynak durumu
alanının yokluğunu gösterirse ve o da yalnız yanıta alan eklemek.

## Kabul kriterleri
- [ ] `grep -n "loadingStep" client/src/App.jsx` boş; sabit kaynak sayısı metni yok.
- [ ] Playwright route gecikmesi 0,2 / 1 / 5 / 25 sn: §3.1 tablosundaki gösterim.
- [ ] İptal gerçekten isteği durdurur (ağ kaydında iptal).
- [ ] 401, 429, 500, 503, zaman aşımı, kısmi, boş yanıt taklidi: her biri kendi mesajı; "Bir hata oluştu" tek başına yok.
- [ ] Boş sonuç "çalışma yok" demez; taranan kaynakları ve yıl aralığını söyler.
- [ ] Kart durum matrisi: her dolu hücre için sabit veriyle ekran görüntüsü.
- [ ] Geri çekilmiş kayıt kartta en üstte; zenginleştirme düşünce kart kırmızı değil.
- [ ] Testler, lint, build geçiyor; Ahmet elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Hata sınıflandırma | `npm test` (`errorClass.test.js`) | Her sınıf |
| Bekleme ve hatalar | `npx playwright test states.spec.js` | §7'nin son 4 satırı |
| Regresyon | `npx playwright test` | Önceki sayı geçiyor |

## Ölçüm
Arama süresi p50/p95 (Faz 0'da ölçülür, sonra izlenir). Kalite metriği
yok (4.7).

## Geri alma
Faz başına commit; dal `git revert`. Sunucu yanıtına eklenen alan isteğe
bağlı; eski istemci yok sayar.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Yanıtta kaynak durumu yok, sunucu değişikliği büyür | Orta | Süre | Faz 0 önce; büyükse ayrı iş emri |
| İptal edilen istek sunucuda sürer | Orta | Maliyet | Arayüz "iptal edildi" der, "yapılmadı" demez (§3.1) |

## Onay gereken noktalar
- Faz 0 sonrası sunucu değişikliği gerekirse kapsamı.

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
