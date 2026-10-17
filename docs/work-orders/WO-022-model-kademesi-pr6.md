# WO-022 — Görsel yapı model kademesi (PR6.v2) ve E5

| Alan | Değer |
| --- | --- |
| Durum | Taslak (17.10.2026) |
| Kapsam | Çapraz (sunucu uç noktası + istemci bağlantısı + değerlendirme) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2 oturum + E5 etiketlemesi (iki kişi) |
| Ön koşul | WO-016 bitti; WO-019 bitti; **E5 pilotu etiketlendi** (30 paragraf, iki insan) |
| Yol haritası aşaması | P3 — `docs/design/yol-haritasi.md` adım 8 |
| Dal | `wo-022-pr6`, WO-019 ucundan |
| Kaynak | Planlardaki adı WO-C. `docs/design/gorsellestirme-plani.md` §4 (PR6.v2), §7 (E5); `docs/eval/E5-etiketleme-kilavuzu.md` |

## Problem
Kural kademesi (WO-016) yalnız yapısı metinde açık olan paragrafları
çözüyor. Ölçüldü (17.10.2026): v2 prototipinin üç paragrafından yalnız
argüman paragrafı yapı verdi; süreç ve etken paragrafları sinyal taşıdığı
halde yapı vermedi. Kullanıcı tipik bir paragrafta şekli elle kurmak zorunda.

## Neden şimdi
WO-019'daki "elle kur" yolu çalışır ama yavaş. Model kademesi şekil
özelliğini çoğu paragrafta kullanılır kılar. Tüzük 4.1 gereği ölçüm kümesi
(E5) olmadan başlamaz.

## Kapsam
### Dahil
- **E5 pilot kümesi** `eval/e5_visual_structure.jsonl`: 30 paragraf, farklı
  disiplinler, TR + EN; iki insan etiketleyici; Cohen kappa (kategorik), F1
  (düğüm sınırı). Etiketler testten önce (4.3).
- **PR6.v2** (§4): numaralı cümleler girer; atıf, yazar, yıl girmez (3.1);
  katı JSON şeması (`nodes`, `edges`, `unsure`); `span` cümleden birebir;
  kutup işareti yalnız yön fiili varsa; ilişki yoksa boş dizi; şablon adı yok.
- **Kod doğrulaması**: her `span` `fold` sonrası cümlede alt dizgi değilse
  atılır, "N öğe metinde bulunamadığı için atıldı" yazılır. Çıktı WO-016
  `validate` + `fitTemplates`'ten geçer.
- **Güvenlik** (3.8): beş katman; pasaj ayracı; araçsız çağrı; enjeksiyon
  örnekleri E5'e eklenir (≥ 3).
- **Önbellek ve ölçümleme** (3.4, 3.9): prompt sabit ve sürümlü; anahtar
  paragraf hash'i + model + `PR6.v2` + şema sürümü; isabet/ıskalama, token,
  süre, maliyet loglanır.
- **Arayüz**: kural kademesi yapı vermezse ✦ "Modelle dene" sunar; sonuç
  WO-019 akışına girer, etiketler cümleye bağlı, "model önerisi" işaretli.
  Belgeye yine yalnız tıklamayla (2.9).

### Hariç
- Model ince ayarı, gömme.
- Bölüm türü tahmini (P6'daki gereksiz alan, §4).

## Dokunulabilecek dosyalar
- `server/services/visualStructure.js` (yeni), `server/prompts/PR6.v2.js` (yeni), uç nokta kaydı (`server/index.js` yalnız rota satırı)
- `server/tests/visualStructure.test.js` (yeni)
- `client/src/visuals/model.js` (yeni; istek + doğrulama), `client/src/components/workspace/FigurePanel.jsx` (yalnız "Modelle dene")
- `eval/e5_visual_structure.jsonl` (yeni), `eval/run_e5.mjs` (yeni), `eval/results/` (yeni)
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `docs/work-orders/README.md`, `CLAUDE.md` (3. bölümdeki "eval/ yok" maddesi güncellenir), bu dosya

## Yaklaşım
Model sınıfı orta (3.7: yapı çıkarma doğrulama değil); sağlayıcı arayüz
arkasında. Kod doğrulaması modele güvenmez: birebir olmayan her öğe atılır.
E5 sonuçları `eval/results/` altına tarih ve sürümle.

## Kabul kriterleri
- [ ] E5 pilotu: 30 paragraf, iki etiketleyici, kappa ve F1 raporlandı.
- [ ] Doğrulamadan sonra birebir olmayan etiket oranı **= 0** (E5'te ölçüldü).
- [ ] Düğüm recall/precision ve kenar doğruluğu E5'te ölçüldü ve raporlandı ("pilot kümede" diye, 4.5).
- [ ] Enjeksiyon örneklerinin hiçbiri şemayı veya etiketi bozmadı.
- [ ] Prompt'ta atıf/yazar/yıl yok (birim test prompt metnini tarar).
- [ ] Önbellek anahtarı ve ölçümleme logları var (birim test).
- [ ] v2'nin süreç ve etken paragraflarında model önerisi WO-019'da çizilebiliyor (elle deneme).
- [ ] Testler, lint, build geçiyor; Ahmet elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Şema ve doğrulama | `server: npm test` | Birebir olmayan atılır |
| E5 | `node eval/run_e5.mjs` | Sonuç dosyası, metrikler |
| Enjeksiyon | E5 içinde | 0 başarılı |

## Ölçüm
| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| Birebir olmayan etiket oranı | — | 0 |
| Kural + model kademesinin yapı verdiği paragraf oranı (E5) | Kural kademesi ölçülür | Ölçülür, eşik pilotla konur |
| Elle düzenlenen etiket oranı | — | İzlenir (4.8) |

## Geri alma
`VISUAL_MODEL_ENABLED` sunucu bayrağı (varsayılan `false`; CLAUDE.md 3.12'ye
eklenir). Kapalıyken "Modelle dene" görünmez; kural kademesi ve elle kur
çalışmaya devam eder.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| E5 etiketlemesi gecikir | Yüksek | İş başlamaz | Kılavuz hazır; 30 paragraf küçük |
| Model kenar yönünü ters kurar | Orta | Yanlış şekil | Kenar doğruluğu ayrı ölçülür; kullanıcı düzenler; "model önerisi" işareti |
| Maliyet | Düşük | — | Önbellek; yalnız kullanıcı isteyince |

## Onay gereken noktalar
- Model sağlayıcısı ve sınıfı (bugün kullanılan sağlayıcı WO-001 envanterinde).
- İkinci etiketleyici kim.
- `eval/` klasörünün açılması (CLAUDE.md'deki "eval/ yok" durumu değişir).

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
