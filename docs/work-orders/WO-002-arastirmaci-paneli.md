# WO-002 — Araştırmacı paneli: arama kartından ayrı panel

| Alan | Değer |
| --- | --- |
| Durum | Çalışıyor (2026-10-11'den beri; yerel dal `wo-002-yazar-paneli`, commit ve push yok) |
| Kapsam | Tek modül (yalnızca istemci) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1 oturum |
| Ön koşul | Yok. **İstisna:** `docs/work-orders/README.md`'ye göre WO-002, WO-001'den türetilirdi; kullanıcı kararıyla (2026-10-10) WO-001'den önce açıldı |
| Yol haritası aşaması | P1 |

## Durum notu (2026-10-13)

Kod yazıldı: lint temiz, build başarılı, sunucu testleri 367/367
(2026-10-11). Sekme adı "Araştırmacı ara" olarak değiştirildi (2026-10-13).
Elle test bekliyor (aşağıdaki test planı). Commit ve push yok.

## Problem
Yazar araması bugün arama kartının içinde bir sekme ve konu aramasıyla aynı
durumu paylaşıyor — 2.11'deki "her panel kendi giriş noktası, arama
sonuçlarına bağlı çalışmaz" kuralına aykırı (satırlar `1377c5e`'ye göre):

- Mod ve seçili yazar arama kartının durumunda: `searchMode`,
  `selectedAuthor` (`client/src/App.jsx:135-137`)
- Aynı `handleSearch`, aynı `data` ve sonuç listesi; yazar seçili değilse
  hata mesajı da oradan (`client/src/App.jsx:396-411`)
- Yazar sayfalaması konu aramasının `data`'sına ekleniyor
  (`client/src/App.jsx:490-512`)
- Geçmişten açılan yazar araması arama kartını yazar moduna çeviriyor
  (`client/src/App.jsx:612`)
- "Benzerini bul" yazar modunu kapatıp konu aramasına geçiriyor
  (`client/src/App.jsx:405-407`)

## Neden şimdi
Yazar araması canlıda (1377c5e) ve kurum + ORCID ile büyüdü; arama kartının
içinde büyümeye devam ederse ayırmak her gün pahalanır. Kodda bunun hazır
bir kalıbı var: referans kontrolü zaten ayrı panel (`mode === 'verify'`,
`CitationChecker`, `client/src/App.jsx:668-685`).

## Kapsam
### Dahil
- Üst sekmelere yeni panel: "Literatür ara | Araştırmacı ara" (referans
  kontrolü sekmesi gizli kaldığı sürece iki sekme görünür)
- Yeni `AuthorPanel` bileşeni, kendi durumuyla: seçili yazar, isteğe bağlı
  konu, eser listesi, sayfalama, yükleniyor/hata
- Yazar kartı: ad, kurum, yayın/atıf/h, ORCID linki, ORCID kurumları
  (zenginleştirme, 3.10)
- Eser listesi mevcut `ResultCard` ile; sepete ekleme mevcut `basket` ile
  (sepet paneller arası ortak kalır)
- Arama kartından "Konuya göre / Yazara göre" sekmeleri ve yazar dalları
  kaldırılır; arama kartı yalnızca konu araması olur
- Geçmişten açılan yazar araması Araştırmacı panelini açar
- Bayrak: `AUTHOR_PANEL_ENABLED`. `false` iken bugünkü davranış aynen kalır

### Hariç
- Sunucu: hiçbir uç değişmez. Panel mevcut `/api/authors`,
  `/api/authors/orcid` ve `/api/search?authorId=` uçlarını kullanır
- AI analiz, yazım paneli, AHP ağırlık ayarı: panelde yer almaz
- "Burcu Kelleci Çakır" sorunu (isim benzerliği eşiği yok): WO-001 notu
- Yazar karşılaştırma, ortak yazar ağı, atıf grafiği: kapsam dışı
Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar
- `client/src/App.jsx`
- `client/src/components/AuthorPanel.jsx` (yeni)
- `client/src/utils/authorResults.js` (yeni; 2026-10-11 kullanıcı onayıyla eklendi — panel ile App'in ortak yardımcıları, lint `react-refresh/only-export-components` gereği ayrı dosyada)
- `client/src/components/AuthorPicker.jsx` (yalnızca prop eklemek gerekirse)
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/src/styles/ui.css`
- `docs/work-orders/WO-002-arastirmaci-paneli.md` (yalnızca durum ve bitiş raporu)

## Yaklaşım
1. `CitationChecker` kalıbı izlenir: `mode` durumu `'search' | 'author' |
   'verify'` olur; `mode === 'author'` iken `AuthorPanel` çizilir, arama
   kartı çizilmez.
2. `AuthorPanel` eserleri `/api/search?authorId=…&authorPage=…` ile çeker;
   sayfalama ve tekrar ayıklama `loadMoreAuthor`'daki mantıkla aynıdır
   (`App.jsx:493-512`), ama panelin kendi durumunda. Bu mantık App.jsx'ten
   panele **taşınır**, kopyalanmaz.
3. Konu aramasına ait `searchMode`, `selectedAuthor`, `activeAuthor`,
   `authorOverride` yolları App.jsx'ten çıkar. `handleSearch` yalnız konu
   araması yapar.
4. Geçmiş kaydı aynı uçla (`/api/history`) ve aynı alanlarla yazılır; yalnız
   açılırken `authorId` varsa `mode = 'author'` olur.
5. Bayrak `false` iken eski kod yolu durur; bayrak `true` ve iş bitince eski
   yol ayrı bir iş emriyle silinir. Bu iş emri iki yolu birden taşır.

Alternatif — yeni rota (`/yazar`): seçilmedi. Uygulamada yönlendirici yok;
eklemek bağımlılık ekler (1. bölüm, kural 6) ve paylaşım linkleriyle
çakışır.

## Kabul kriterleri
- [ ] `AUTHOR_PANEL_ENABLED=true`: üst sekmelerde "Araştırmacı ara" var;
      arama kartında yazar sekmesi yok
- [ ] Yazar panelinde arama yapmak konu aramasının sonuçlarını, durumunu
      veya hata mesajını değiştirmiyor; tersi de geçerli (iki panel arasında
      geçip dönünce her biri kendi sonucunu koruyor)
- [ ] Panelde: isim → aday → seçim → eser listesi; "daha fazla" ile sonraki
      200'lük sayfa; isteğe bağlı konu
- [ ] Panelden sepete eklenen eser yazım panelinde görünüyor
- [ ] Geçmişten açılan yazar araması Araştırmacı panelini açıyor
- [ ] `AUTHOR_PANEL_ENABLED=false`: davranış 1377c5e ile aynı
- [ ] Sunucu testleri 367/367 geçiyor (sunucu değişmediği için sayı aynı)
- [ ] `eslint` temiz, `npm run build` geçiyor
- [ ] Bölüm 3 ihlali yok
- [ ] Hiçbir şey push edilmedi; iş `wo-002-yazar-paneli` dalında, yerelde

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Sunucu regresyonu | `cd server && npm test` | 367/367 |
| Lint / build | `cd client && npm run lint && npm run build` | Temiz / başarılı |
| Panel bağımsızlığı | Konu araması yap → Araştırmacı paneline geç, yazar ara → konuya dön | Konu sonuçları yerinde |
| Eser sayfalama | "Aziz Sancar" → seç → "daha fazla" | 647 eserin sonraki 200'ü eklenir, tekrar yok |
| Sepet | Panelden 2 eser ekle → yazım panelini aç | 2 eser kaynaklarda |
| Geçmiş | Yazar araması yap → geçmişten aç | Araştırmacı paneli açılır |
| Bayrak kapalı | `AUTHOR_PANEL_ENABLED=false` | 1377c5e ile aynı ekran |
| Dar ekran | 375 px genişlik | Yatay kaydırma yok |

İstemcide otomatik test altyapısı yok; panel davranışı elle kontrol edilir
ve rapora adım adım yazılır.

## Ölçüm
Ölçülmeyecek: bu bir yapı değişikliği, kalite iddiası taşımıyor. Yalnızca
eser ilk sayfasının süresi kayda geçer (bugün Sancar 3,7 sn, Hinton 1,9 sn)
ve düşmemiş olmalı.

| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| Yazar eser ilk sayfa süresi | 1,9–3,9 sn | Aynı (sunucu değişmiyor) |

## Geri alma
Bayrak: `AUTHOR_PANEL_ENABLED=false` eski davranışa döner. Dal hiçbir zaman
main'e girmezse geri almaya gerek yok; girerse tek commit grubu
`git revert` ile döner.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| App.jsx'te konu aramasını bozmak (fuar ekranı) | Orta | Yüksek | Bayrak; main'e girmeden önce elle test; push yok |
| Sepet / yazım paneli iki panelden beslenince durum çakışması | Düşük | Orta | Sepet zaten ortak `useBasket`; panel yalnız `add` çağırır |
| Geçmiş kaydı biçimi değişirse eski kayıtlar açılmaz | Düşük | Orta | Biçim değişmez, yalnız açılış yönü değişir |

## Onay gereken noktalar
- Taslak → Hazır geçişi (kullanıcı)
- ~~Sekme adı~~ — karar (2026-10-13): "Araştırmacı ara" (`CLAUDE.md` 2.13)
- ~~Arama kartındaki yazar sekmesi kalksın mı~~ — uygulandı: evet (2026-10-11)
- İş bittikten sonra main'e alma: ayrı karar, bu iş emrinin parçası değil

## Bitiş raporu
Ajan tarafından doldurulur.
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:** READY / NEEDS ATTENTION / BLOCKED
