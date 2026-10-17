# WO-021 — Bekleme, hata ve kart durumları

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (17.10.2026, `wo-021-durumlar`; kullanıcı onayı: MVP kapsamı) |
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
- **Değişen dosyalar:** istemci — yeni `components/states/errorClass.js`,
  `SearchStates.jsx`, `useElapsed.js`, `tests/errorClass.test.js`,
  `e2e/states.spec.js`; değişen `App.jsx`, `styles/states.css`, `i18n/tr.js`,
  `i18n/en.js`. Sunucu — `services/search.js`, `index.js`, yeni
  `tests/searchEmptyOutcome.test.js`.
- **Faz 0 bulguları (envanter):**
  - `/api/search` zaten `failedSources` döndürüyordu ama istemci hiç
    göstermiyordu (düşen kaynak sessizce kayboluyordu — 2.11 madde 3).
  - **Ciddi:** sonuç boşken sunucu her durumda "demo moduna" geçip
    `exdata.json`'daki kayıtları döndürüyordu. Kaynaklar yanıt verip sorgu
    gerçekten eşleşmediğinde de kullanıcı alakasız örnek makaleler ve
    "hiçbir kaynağa ulaşılamadı" mesajı görüyordu (2.8 ihlali).
  - 429 mesajı "Sistem demo verilerle devam ediyor" diyordu, oysa hata
    dönüyordu.
  - Bekleme ekranının metinleri doğrulanmamış iddialar taşıyordu ("9 Açık
    Kaynak", "SJR Q1-Q4 & Atıf Skoru", "AHP ağırlıklarınla sıralanıyor" —
    kullanıcı ağırlık seçemiyor).
  - Arama süresi p50/p95 ölçülmedi (canlı veri yok; yerelde sahte sunucu).
- **Teknik kararlar:**
  - Sunucu: `queriedSources` ve `emptyOutcome` saf fonksiyon (birim testli).
    Boş sonuç → `{ results: [], empty: true, sourcesQueried }`; sorgulanan
    her kaynak düştüyse canlıda 503 `SOURCES_UNAVAILABLE` (düşen kaynaklarla),
    yalnız geliştirmede işaretli örnek veri. Yanıta `sourcesQueried` eklendi.
    CORS `exposedHeaders: ['Retry-After']` (tarayıcı başlığı göstermiyordu —
    e2e yakaladı; gerçek sunucuda doğrulandı).
  - İstemci: zamanlayıcılı aşama metni ve dört aşamalı gösterge kalktı.
    300 ms altında hiçbir şey; sonra düğmede "Aranıyor…"; 2 sn sonra
    iskelet + gerçek süre + İptal (`AbortController`); 20 sn sonra
    "beklenenden uzun". Hata `classifyError` ile 10 sınıfa ayrılır, her biri
    ne olduğunu, kaybedilen olup olmadığını ve ne yapılacağını söyler; 429'da
    geri sayım; teknik ayrıntı katlanır. Boş sonuç taranan kaynakları sayar,
    "çalışma yok" demez; kısmi sonuçta yanıt vermeyen kaynaklar adıyla.
  - Faz 3 (kart durumları): sonuç kartında geri çekilmiş / endişe beyanı
    şeridi, "özet yok", "yıl bilinmiyor" zaten vardı (doğrulandı,
    `ResultCard.jsx:74-140`); yenisi kısmi ve boş sonuç. Taslak ve analiz
    kartlarının hata durumları WO-011'de var; kanıt kartı WO-005 ile.
- **Testler:** istemci birim 323/323 (yeni `errorClass` 4); sunucu yeni
  `searchEmptyOutcome` 5/5; lint temiz; yeni `e2e/states.spec.js` 10/10
  (bekleme eşikleri, sahte metin yok, İptal ve yeniden arama, 401 / 429
  geri sayım / 500 / 503 / bütün kaynaklar düştü, çevrimdışı, boş sonuç,
  kısmi sonuç). Tam kontrol sonuçları commit mesajında.
- **Ölçülen etki:** ölçülmedi (kalite metriği yok, 4.7). Arama süresi
  ölçümü canlı veriyle yapılmalı.
- **Bilinen eksikler:** B yolu (SSE ile kaynak kaynak ilerleme) yok —
  ayrı karar. "Yalnız düşen kaynağı tekrar dene" düğmesi yok (B yolunu
  ister). Oturum düşünce "Giriş yap" düğmesi yerine "Tekrar dene" çıkıyor
  (Clerk giriş akışı bağlanmadı).
- **Sonraki adım:** WO-023 (kendi yapay zekâ anahtarın).
- **Durum:** NEEDS ATTENTION — testler geçti; canlı kaynaklarla davranış
  (gerçek boş sonuç, gerçek 429) yerelde sahte sunucuyla denendi.
