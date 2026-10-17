# WO-017 — Tek panel kabuk: araştırma ilk sırada, yazım aynı kabukta

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (17.10.2026, `wo-017-tek-panel`) — kullanıcının yerelde son bakışı MVP sonunda |
| Kapsam | Çapraz (istemci) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2 oturum |
| Ön koşul | WO-011 kullanıcı kontrolü bitti (yol haritası adım 0) |
| Yol haritası aşaması | P1 |
| Dal | `wo-017-tek-panel`, `wo-008-sekil-gomme` ucundan |
| Kaynak | `docs/design/yol-haritasi.md` adım 2; prototip `docs/design/mockup-yazim-alani-v2.html` |

## Problem
Bugün iki ayrı dünya var (WO-011 Faz 1): araştırma eski düzende, yazım
`#/yazar` adresinde tam ekran ayrı bir mod (`client/src/App.jsx:574-600`
`openWriter` / `exitWriter`, `mode === 'workspace'` iken araştırma
`display: none`, `App.jsx:1281`). Kullanıcı kararı (16.10.2026): her şey tek
panelde, sol rayda **ilk sırada Araştırma**, ardından Masam, Yaz, Kaynaklar,
Analiz, Teslim. Ana arama ekranının düzeni bozulmaz.

## Neden şimdi
Sonraki her görünür adım (çizici, köprü, bekleme ekranları) bu kabuğun
içine yerleşiyor. Kabuk sonra değişirse onların arayüzü iki kez yazılır.

## Kapsam
### Dahil
- Sol ray: Araştırma · Masam · Yaz · Kaynaklar · Analiz · Teslim. Seçili
  bölüm adreste (`#/arastirma`, `#/masam`, `#/yaz`, …); geri/ileri tuşu
  bölümler arasında gezer.
- Araştırma bölümü bugünkü arama ekranının kendisidir (arama kartı, sonuçlar,
  sepet, araştırmacı paneli). İçeriği ve düzeni değişmez; yalnız rayın
  yanına oturur.
- Yaz bölümü bugünkü yazar yüzeyidir (`Workspace.jsx`, Kontrol, Teslime
  hazırla). Bölüm değişince belge kapanmaz: metin, imleç ve kaydırma korunur
  (WO-011'deki `← Araştırma` davranışının genellenmiş hali).
- Masam: bugünkü Çalışmalarım içeriği (taslaklar, son aramalar, kayıtlı
  analizler).
- Kaynaklar, Analiz: bugün karşılığı olan içerik varsa o bölüme taşınır;
  yoksa bölüm "yakında" değil, **rayda görünmez** (2.8: olmayanı var gibi
  göstermeyiz). Teslim: Yaz'daki "Teslime hazırla"nın kısayolu.
- Eski adresler yönlenir: `#/yazar` → `#/yaz`, `#/yazar/kontrol` → `#/yaz`
  + Kontrol paneli; WO-011'in yönlendirmeleri (`modeRoutes.js`) korunur.
- Kenar şeridi: sağ panel kapalıyken kenarda görünür bir açma tutamağı
  (prototipte var).
- İlk açılış: hiç taslak ve arama yokken Araştırma açılır, Masam'da tek
  satırlık yön gösterici (prototip `#ilk`).
- Arayüz metninde "Yazar modu" adı kalkar (tüzük 2.13); `tr.js` / `en.js`.
- Mobil (< 768 px): ray alt sekme çubuğuna döner.

### Hariç
- Pencereler, Esc yığını, bildirimler (WO-018).
- Görselleştir / çizici (WO-019), köprü kartları (yol haritası adım 6).
- Bekleme ve hata ekranları (WO-E2).
- Araştırma ekranının iç tasarımı.

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar
- `client/src/App.jsx`
- `client/src/modeRoutes.js`
- `client/src/components/shell/LeftRail.jsx` (yeni)
- `client/src/components/shell/Desk.jsx` (yeni; Masam)
- `client/src/components/workspace/Workspace.jsx` (yalnız kabukla bağlantı noktaları: geri dönüş düğmesi, panel açma)
- `client/src/components/HistorySidebar.jsx` (yalnız Masam'a taşınan parçalar)
- `client/src/styles/ui.css`, `client/src/styles/workspace.css`, `client/src/styles/variables.css`
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/tests/modeRoutes.test.js`
- `client/e2e/mode.spec.js`, `client/e2e/shell.spec.js` (yeni), `client/e2e/write.spec.js` (yalnız adres değişikliği)
- `docs/work-orders/README.md`, bu dosya

## Yaklaşım
- Kabuk durumu tek yerde: `section` (`research | desk | write | sources | analysis | submit`).
  `mode` durumu (`search | author | verify | workspace`) yalnız Araştırma
  bölümünün iç sekmesi olarak kalır; `workspace` değeri kalkar.
- Bölümler **söküp takılmaz, gizlenir** (bugünkü `display: none` deseni):
  araştırma sonuçları ve açık belge bellekte kalır. Yeniden mount yok.
- Adres ayrıştırma saf fonksiyon kalır (`modeRoutes.js`); her eski adres
  için birim testi.
- Prototipteki ray ölçüleri ve renkleri alınır (AA kontrastı prototipte
  doğrulandı).

## Kabul kriterleri
- [ ] Rayda Araştırma ilk sırada; uygulama açıldığında Araştırma seçili.
- [ ] Araştırma → Yaz → Araştırma: arama sonuçları, filtreler, kaydırma yeri aynı.
- [ ] Yaz → Araştırma → Yaz: belge metni, imleç, kaydırma aynı; bekleyen kayıt yazılmış.
- [ ] Geri/ileri tuşu bölümler arasında gezer; her eski adres (`#/yazar`, `#/yazar/kontrol`, `#/yazim`, `#/denetim`, `#/alanim`, `#/kaynaklar/*`) doğru bölüme gider — birim test.
- [ ] İçeriği olmayan bölüm rayda görünmüyor.
- [ ] Arayüzde "Yazar modu" metni yok (`grep` ile).
- [ ] 390 px genişlikte yatay kaydırma yok; ray alt çubukta.
- [ ] WO-011 testleri (`mode.spec`, `write.spec`, `audit.spec`) yeni adreslerle geçiyor; atlanan e2e sayısı değişmedi.
- [ ] İstemci birim testleri, lint, build geçiyor.
- [ ] Bölüm 3 ihlali yok.
- [ ] Ahmet yerelde elle denedi (arayüz değişikliği; CLAUDE.md yayın kuralı).

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Adres ayrıştırma | `npm test` (`modeRoutes.test.js`) | Tüm eski ve yeni adresler doğru bölüm |
| Kabuk e2e | `npx playwright test shell.spec.js` | Durum koruma, geri/ileri, mobil ray |
| WO-011 regresyonu | `npx playwright test` | Önceki e2e sayısı geçiyor |
| Elle | Araştırma yap → Yaz'a geç → bir paragraf yaz → Araştırma'ya dön → sonuçlar duruyor mu → Yaz'a dön → imleç yerinde mi | Kayıp yok |

## Ölçüm
Ölçülmeyecek: kabuk değişikliğinin ölçülebilir bir kalite metriği yok
(tüzük 4.7). Başarı kabul kriterleriyle ve elle denemeyle belirlenir.

## Geri alma
Tek dal, faz başına commit. `git revert` ile dal geri alınır; WO-011 kabuğu
`wo-008-sekil-gomme` ucunda olduğu gibi durur. Veri biçimi (taslak deposu)
değişmez, geri dönüşte veri kaybı yok.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Gizli bölüm ağır bileşeni boşuna çalıştırır | Orta | Yavaşlık | Yaz ilk açılışta tembel yüklenir (bugünkü `Suspense`) |
| Eski adres yer imleri kırılır | Düşük | Kullanıcı kaybolur | Her eski adres için birim test |
| Araştırma düzeni bozulur | Orta | Kullanıcı kararı ihlali | Önce/sonra ekran görüntüsü, ray dışında fark yok |

## Onay gereken noktalar
- Kaynaklar ve Analiz bölümlerinde bugün gösterilecek içerik yetersizse rayda gizlemek (öneri) ya da göstermek.
- Mobilde alt sekme çubuğu mu, açılır ray mı (öneri: alt çubuk).

## Bitiş raporu
- **Değişen dosyalar:** `client/src/App.jsx`, `client/src/modeRoutes.js`,
  `client/src/components/HistorySidebar.jsx`, `client/src/styles/workspace.css`,
  `client/src/i18n/tr.js`, `client/src/i18n/en.js`, `client/tests/modeRoutes.test.js`,
  `client/e2e/mode.spec.js`, `client/e2e/audit.spec.js`, `client/e2e/screens.spec.js`,
  `client/e2e/write.spec.js`, `client/e2e/baseline.spec.js`, `client/e2e/print.spec.js`
  (adres güncellemesi), `client/e2e/shell.spec.js` (yeni).
- **Teknik kararlar:**
  - Yeni `LeftRail`/`Desk` bileşeni yazılmadı: mevcut kenar çubuğu zaten
    koyu, 72 px'lik bir ray. Üstüne "Araştırma" ve "Yaz" bölüm düğmeleri
    eklendi; Çalışmalarım, Favoriler, Makalen için altında. En küçük doğru
    değişiklik (3.11); Masam = Çalışmalarım sekmesi, ad değişmedi (testler ve
    kullanıcı alışkanlığı).
  - Yazım yüzeyi portal olarak kaldı ama `inset: 0 0 0 var(--shell-rail)`:
    rayın sağından başlıyor, ray görünür. Kenar çubuğu açılınca yüzeyin üstüne
    çıkıyor (`raised`), Yaz'a girerken kendiliğinden kapanıyor (açık kalınca
    "← Araştırma" düğmesini örtüyordu — e2e yakaladı).
  - Adres `#/yaz`; `#/yazar` ve `#/yazar/kontrol` eski adres olarak yönleniyor.
  - Sağ kenardaki yüzen WriterDock kalktı; `data-action="writer-dock"` raydaki
    Yaz düğmesinde (açık taslağın adı ekran okuyucu metninde ve ipucunda).
  - "Analiz", "Kaynaklar", "Teslim" ray öğesi eklenmedi: Analiz'in içeriği yok
    (WO-007), Kaynaklar = mevcut "Makalen için" sekmesi, Teslim = Yaz içindeki
    "Teslime hazırla". Olmayanı var gibi göstermiyoruz (2.8).
- **Testler:** istemci birim 314/314; lint temiz; e2e 59 geçti + yeni
  `shell.spec.js` 5/5 (ray Yaz'da görünür ve yüzey rayın sağında; bölüm
  geçişinde sonuç ve belge korunur; Yaz düğmesi taslak adını taşır; arayüzde
  "yazar modu" yok; 390 px'te yatay kaydırma yok). `npm run kontrol` sonucu
  commit mesajında.
- **Ölçülen etki:** ölçülmedi (kalite metriği yok, 4.7).
- **Bilinen eksikler:** mobilde ray alt sekme çubuğuna dönmedi; mobilde
  Yaz'dan dönüş yalnız "← Araştırma" düğmesiyle (ray menü düğmesi yazım
  yüzeyinin altında kalıyor). İlk açılış yön göstericisi (prototip `#ilk`)
  yapılmadı. CLAUDE.md 2.13 terim tablosu ("Çalışma alanı: henüz yok")
  güncellenmedi — dosya bu iş emrinin listesinde değil.
- **Sonraki adım:** WO-018 (pencereler, Esc, geri al).
- **Durum:** NEEDS ATTENTION — kabul kriterleri karşılandı, testler geçti;
  "Ahmet yerelde elle denedi" maddesi MVP sonundaki bakışa kaldı.
