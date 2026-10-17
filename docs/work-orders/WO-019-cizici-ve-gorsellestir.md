# WO-019 — Çizici ve Görselleştir: paragraftan şekil, belgeye ekleme

| Alan | Değer |
| --- | --- |
| Durum | Taslak (17.10.2026) |
| Kapsam | Tek modül + yazım yüzeyine bağlantı |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2–3 oturum |
| Ön koşul | Şekil galerisi kararları (yol haritası adım 1); WO-017 bitti; WO-016 bitti |
| Yol haritası aşaması | P3 |
| Dal | `wo-019-cizici`, WO-018 ucundan (WO-018 bitmediyse WO-017 ucundan) |
| Kaynak | Planlardaki adı WO-D. `docs/design/yol-haritasi.md` adım 4; `docs/design/gorsellestirme-plani.md` §5–§6; galeri `docs/design/mockup-sekil-galerisi.html` |

## Problem
WO-016 paragraftan yapı ve uygun şablon ailesini çıkarıyor
(`client/src/visuals/`), ama arayüze bağlı değil. Kullanıcı yazım alanında
hiç şekil göremiyor.

## Neden şimdi
Yol haritasının ilkesi: her adım uygulamada görünür bir şey bırakır. WO-008
(Word/PDF'e gömme) dışa aktaracak şekil olmadan anlamsız. Bu yüzden çizici
WO-008'den önce (yol haritası sıra kararı, 17.10.2026).

## Kapsam
### Dahil
- **Çizici** (`client/src/visuals/render/`): galeride "Kalsın" alan
  şablonlar. Galeri kodunun yerleşim mantığı modüllere taşınır; girdi WO-016
  yapısı (`visual-structure/1`), çıktı SVG dizgesi.
- **Görselleştir**: paragrafın yanında ✦. Tıklayınca sağ panelde aile
  önerisi (WO-016 `fitTemplates`) ve o ailenin görünümleri. Uygun aile
  yoksa nedeni gösterilir (WO-016 `unfit.*`), boş şekil çizilmez.
- **Düzenleme**: etiket metni, öğe ekle/çıkar, sıra, tema (renkli / sade),
  simge aç/kapat ve değiştir. Her etiket cümleden ya da kullanıcıdan gelir.
- **Belgeye ekle** (2.9): yalnız tıklamayla; şekil numarası ve başlık;
  "Düzenle" ile yeniden açılır; "Kaldır" geri alınabilir (WO-018 bildirimi).
- **Kaynak değişti**: `checkSource` sonucu yalnız şekle bakınca ya da
  düzenlemeye açınca görünür (plan §5 WO-D notu); `relocated` uyarısız;
  `changed` / `missing` için "Yeniden oluştur / Olduğu gibi bırak".
- Şekil durumu (yapı, şablon, tema, mühür) belgeyle saklanır.
- **Elle kur** (bulgu 17.10.2026, aşağıda): kural kademesi yapı çıkaramazsa
  ✦ yine görünür ve iki yol sunar: sinyalin önerdiği aileden şablon seç,
  paragrafta metin seçerek öğe ekle (seçim = düğüm; etiket cümleye bağlı,
  izlenebilirlik korunur), öğeler arası ok etiketini de seçimle ya da
  yazarak ver. Profilde sinyal varsa (`cycle`, `cause` …) o aile üstte
  önerilir, "kural kademesi bu paragraftan yapı çıkaramadı" diye söylenir
  (2.8). Model yok.
- **Neden bu şablon**: her önerinin altında tek satır gerekçe ("“geri döner”
  geçiyor: dönüş kapanıyor"); uymayanlar katlanır listede nedeniyle (WO-016
  `fit.*` / `unfit.*` kodlarının Türkçe metni). Galerideki "Gerçek paragraf"
  bölümü bu davranışı gösteriyor.
- **Etiketten cümleye**: şekildeki etikete tıklayınca belgede kaynak cümle
  vurgulanır; etiket altında "n. cümle" notu (izlenebilirlik, tüzük 2.12/2).
- **Ok etiketleri**: akış ve döngüde iki öğe arasındaki fiil okun üstünde.
- **İndir**: şekli tek başına SVG ve PNG (2×) olarak indirme. PNG'de yazı
  tipi gömme WO-008'de; bu iş emrinde sistem yazı tipiyle.

### Hariç
- Word/PDF'e gömme (WO-008). Bu iş emrinde dışa aktarmada şekil yerine
  "[Şekil N — dışa aktarma WO-008 ile gelecek]" yer tutucusu çıkar; sessizce
  kaybolmaz (2.8).
- Model kademesi PR6.v2 (WO-C): karşılaştırma, dörtlü matris, Venn bu
  iş emrinde yalnız elle doldurulur.
- Veriden görseller (WO-B).

## Dokunulabilecek dosyalar
- `client/src/visuals/render/*` (yeni: `text.js`, `theme.js`, `icons.js`, şablon başına bir dosya, `index.js`)
- `client/src/visuals/icons.json` (yeni; lucide yol verisi, yalnız kullanılan simgeler)
- `client/scripts/extract-icons.mjs` (yeni; `icons.json`'u üreten betik)
- `client/src/components/workspace/FigurePanel.jsx` (yeni), `client/src/components/workspace/Workspace.jsx` (✦ düğmesi, şekil düğümü, panel bağlantısı)
- `client/src/components/workspace/exportDocument.js` (yalnız yer tutucu)
- `client/src/styles/workspace.css`
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/tests/render.test.js` (yeni), `client/tests/visuals.test.js` (yalnız ekleme)
- `client/e2e/figure.spec.js` (yeni)
- `docs/work-orders/README.md`, `docs/design/yol-haritasi.md`, bu dosya

## Yaklaşım
- Çizici saf: `render(structure, template, options) → { svg, width, height }`.
  DOM'a yalnız yazı ölçümü için dokunur (canvas `measureText`); ölçücü
  enjekte edilir, testte sabit genişlik tablosuyla çalışır.
- S1 ölçütleri baştan uygulanır, böylece WO-008 yalnız gömme işi kalır:
  `foreignObject` yok, metin yalnız `<text>`/`<tspan>`, kelime ortasında
  kırma yok, dış istek yok, simgeler SVG yolu olarak gömülü.
- Galerideki öz-denetim (taşma, çakışma, kutudan taşma, çizim şekil dışında)
  e2e testine taşınır ve her şablon için 3/5/8 öğeyle koşar.
- Yazı tipi: bu iş emrinde sistem yazı tipi; Noto Sans gömme WO-008'de. Ölçüm
  aynı yazı tipiyle yapıldığı için WO-008'de yeniden yerleşim gerekebilir —
  risk tablosunda.

## Kabul kriterleri
- [ ] Galeride "Kalsın" alan her şablon 3/5/8 öğeyle iki temada çiziliyor; öz-denetim 0 sorun (e2e).
- [ ] Çizici çıktısında `foreignObject` yok; dış istek 0 (e2e ağ kaydı).
- [ ] "İlişkilendirilmesi" gibi uzun Türkçe kelime bölünmüyor (birim test).
- [ ] WO-016 test paragraflarından (`tests/fixtures/visuals-paragraphs.json`) uygun aile bulunanların hepsi çizilebiliyor (birim test).
- [ ] Belgeye yalnız "Belgeye ekle" ile giriyor; sayfa yenilenince şekil ve düzenleme durumu yerinde.
- [ ] Paragraf değişince uyarı yazarken görünmüyor; şekle odaklanınca `changed` için iki seçenek çıkıyor (e2e).
- [ ] DOCX dışa aktarmada şekil yerinde yer tutucu var (e2e).
- [ ] İstemci birim, lint, build, önceki e2e geçiyor; bundle artışı raporlandı.
- [ ] Bölüm 3 ihlali yok; şekilde modelden gelen metin yok.
- [ ] Ahmet yerelde kendi paragrafıyla elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Çizici birim | `npm test` (`render.test.js`) | Yerleşim, satır kırma, `foreignObject` yokluğu |
| Şablon öz-denetimi | `npx playwright test figure.spec.js` | Her şablon × 3/5/8 × 2 tema: 0 sorun |
| Akış | aynı dosya | ✦ → öneri → düzenle → ekle → yenile → düzenle → kaldır → geri al |
| Elle | Kendi paragrafını yaz, ✦, şekli düzenle, ekle | Etiketler cümleden; uyarı yalnız bakınca |
| Elle (v2 paragrafları) | Galerideki üç paragrafı (pasif soğutma, akış kararsızlığı, KMR güvenliği) belgeye yapıştır, ✦ | Önerilen şablon galeridekiyle aynı; aynı değilse fark rapora yazılır (WO-016 kural kademesi bunları yakalamayabilir — bulgu, hata değil) |

## Ölçüm
Görsel yapının doğruluğu E5 kümesiyle ölçülür; E5 henüz etiketlenmedi, bu
yüzden bu iş emrinde **ölçülmedi** yazılır (tüzük 4.1). Ölçülenler: bundle
boyutu farkı, şablon öz-denetim sonucu.

## Geri alma
Faz başına commit. Görselleştir düğmesi `FIGURES_ENABLED` istemci bayrağının
arkasında (CLAUDE.md 3.12 tablosuna eklenir); kapatmak arayüzden kaldırır.
Belgede kalan şekil düğümleri bayrak kapalıyken salt okunur görünür,
silinmez.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| WO-008'de gömülü yazı tipiyle genişlik değişir, yerleşim kayar | Orta | Taşma | Ölçücü enjekte; WO-008 aynı öz-denetimi gömülü yazı tipiyle koşar |
| Kural kademesi az paragraf yakalar, kullanıcı ✦'yi çoğu yerde boş görür | **Ölçüldü: yüksek** | Hayal kırıklığı | "Elle kur" yolu kapsamda; sinyale göre aile önerisi. WO-C (model kademesi) bu iş emrinden hemen sonra öne alınabilir — kullanıcı kararı |

**Bulgu (17.10.2026, `structureFromRules` çalıştırılarak):** v2 prototipinin
üç paragrafından yalnız biri kural kademesinde yapı verdi. KMR güvenliği →
R5, 3 düğüm (önerme, iddia, sınırlılık), "Ancak" bağı, öneri `arguman` ✓.
Pasif soğutma → kural yok (profil `cycle: 1`, `direction: 3`). Akış
kararsızlığı → kural yok (profil `cause: 1`, `direction: 3`). Tasarım gereği:
ayraçsız düzyazıdan düğüm kesmek kural kademesine verilmedi (WO-016,
`rules.js` başlığı). Sonuç: gerçek paragrafların çoğunda yapı ya elle ya
modelle kurulacak.
| Simge verisi bundle'ı büyütür | Düşük | Boyut | Yalnız kullanılan simgeler (≈100, ≈20 KB) |

## Onay gereken noktalar
- Galeri kararları (hangi şablonlar girer).
- `FIGURES_ENABLED` bayrağının varsayılanı (öneri: dalda `true`, main'e alınırken kullanıcı kararı).

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
