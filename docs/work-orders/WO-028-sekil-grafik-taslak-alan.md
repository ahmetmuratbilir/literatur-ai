# WO-028 — Şekil ve grafik: Napkin gibi belgede taslak alan, "Tamam" ile ekle

| Alan | Değer |
| --- | --- |
| Durum | Çalışıyor (19.10.2026, kullanıcı: "devam et"). İlk sürüm şablonları Claude seçti (galeri kararı verilmemişti; karar daha önce Claude'a bırakılmıştı): Akış, Döngü, Karşılaştırma, Zaman çizelgesi; grafik: Çubuk, Çizgi |
| Kapsam | Yazım yüzeyi + çizici + dışa aktarma |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2–3 oturum |
| Ön koşul | WO-025 (başlık/numara altyapısı), WO-016 (görsel yapı), WO-026 F3 (çubukta düğme yeri) |
| Yol haritası aşaması | P3 |
| Dal | `wo-028-sekil-grafik` |
| Kaynak | Kullanıcı geri bildirimi 19.10.2026 madde 7–8; araştırma raporu (Napkin akışı, taslak alan yöntemi); WO-019 Faz 3–4 kapsamı |

## Problem
Şekil ve grafik eklenemiyor. Kullanıcı: "Napkin mantığında ölçülü bir panel açılır, o panel oraya yerleştireceğimiz alan; üzerinde şeklini içini ayarlar, tamam deyince seçili metnin altına ya da imlecin oraya eklenir. Grafik de."

## Kapsam
### Dahil
- Biçim çubuğunda Tablo'nun yanında **Şekil** ve **Grafik** düğmeleri (aynı ızgara/menü görünümü).
- **Taslak alan:** belgede seçili paragrafın altında (boş satırdaysa orada) kesik çerçeveli, boyutlandırılabilir alan; üstünde "Taslak — belgede değil" rozeti, içinde mini araç çubuğu (tür, veri, boyut, tema), altında **Tamam / Vazgeç**. Belgede yalnız `contenteditable=false` yer tutucu durur; düzenleyici belgenin DIŞINDA, yer tutucunun üstüne konumlanan katman (tarayıcı düzenlemesi React'i bozmasın).
- Kayıt, dışa aktarma, kelime sayısı ve denetim yer tutucuyu yok sayar (2.9: Tamam'a kadar belgede değil).
- **Şekil:** galerinin "Kalsın" şablonları (WO-019 Faz 3 çizici, saf SVG). Etiketler paragraftaki cümlelerden seçilerek ya da yazılarak; kural kademesi yapı çıkarabildiğinde öneri.
- **Grafik:** recharts; veri kullanıcının girdiği tablodan, belgedeki bir tablodan ya da paragraftaki sayılardan (WO-016 R6). Model veri üretmez (2.8). Belgeye SVG (foreignObject yok).
- **Tamam:** yer tutucu `<figure data-visual-kind>` + "Şekil N." başlığıyla değişir (WO-025 numara altyapısı, `data-seq="figure"`); geri alınabilir. Belgedeki şekle tıklayınca aynı taslak alan yeniden açılır.
- Word: SVG + PNG yedeği gömme WO-008'e kadar yer tutucu metinle (sessizce kaybolmaz).

### Hariç
- Model kademesi (WO-022), Word/PDF'e gerçek gömme (WO-008), istatistik çıktısından grafik (WO-007).

## Dokunulabilecek dosyalar
- yeni: `client/src/components/workspace/DraftFrame.jsx`, `FigureEditor.jsx`, `ChartEditor.jsx`, `client/src/visuals/render/*`, `client/src/visuals/chart.js`
- `Workspace.jsx`, `exportDocument.js`, `workspace.css`, i18n, `App.jsx` (bayrak `FIGURES_ENABLED`)
- testler: `render.test.js`, `chart.test.js`, e2e `figure-chart.spec.js`

## Kabul kriterleri
- [ ] Taslak alan açıkken kayıtlı HTML'de, kelime sayısında ve Word çıktısında şekil yok.
- [ ] Tamam → belgede SVG + "Şekil N." başlığı; Ctrl+Z geri alır; numara tablolardan bağımsız sayar.
- [ ] Grafik değerleri kullanıcının verisiyle birebir; boş veriyle Tamam pasif ve nedeni yazar.
- [ ] SVG'de foreignObject yok; dış istek yok.
- [ ] Birim, lint, e2e geçer; Ahmet elle denedi.

## Geri alma
`FIGURES_ENABLED` bayrağı; commit grubu revert.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Katman, kaydırma/ölçekte yer tutucudan kayar | Orta | Hizasız düzenleyici | Konum her çizimde yer tutucunun ölçüsünden |
| recharts paket boyutu | Orta | İlk açılış yavaşlar | Grafik düzenleyici dinamik `import` |

## Onay gereken noktalar
- Galerideki şablonlardan hangileri ilk sürüme girer (öneri: galeride "Kalsın" alanlar).

## Bitiş raporu (19.10.2026, dal `wo-028-sekil-grafik`)
- **Değişen dosyalar:** yeni `client/src/visuals/draw.js` (saf SVG çizici), `client/src/components/workspace/FigureDraft.jsx` (taslak alan), `client/tests/draw.test.js`, `client/e2e/figure-chart.spec.js`; `Workspace.jsx` (düğmeler, yer tutucu, Tamam/Vazgeç, şekle tıklayınca düzenleme, şekil başlığı numarası, şekiller sayım ve taramadan hariç), `exportDocument.js` (Word'e SVG + PNG yedeği), `workspace.css`, i18n, `App.jsx` (`FIGURES_ENABLED`), `CLAUDE.md` 3.12.
- **Kararlar:**
  - İlk sürüm şablonları Claude seçti (galeri kararı yoktu): Akış, Döngü, Karşılaştırma, Zaman çizelgesi; Çubuk ve Çizgi grafik.
  - Grafikler recharts yerine kendi SVG çizicimizle: belgeye ve Word'e tek parça, foreignObject'siz SVG gerekiyor. recharts bağımlılığı duruyor.
  - Şekil başlığı şeklin altında, tablo başlığı tablonun üstünde (Türkçe tez düzeni). Numara ayrı düğüm, kendini onarır (WO-025 altyapısı).
  - Eklemenin sonunda her zaman boş satır: yoksa Chrome başlığı sonraki paragrafla birleştirip numarayı siliyordu (e2e yakaladı).
  - Biçim çubuğunda yer açmak için Tablo, Şekil, Grafik ve Sayfa ayarları yalnız simge (ipucu ve erişilebilir ad var).
- **Testler (çalıştırıldı):** istemci birim 345/345, lint temiz, sunucu 462/462, e2e 103 geçti / 3 atlandı (yeni figure-chart 2/2: taslak belgede değil, Paragraftan al, Tamam, Ctrl+Z/Y, yeniden düzenle, grafikte sayı olmayan satır sayılır, numara 1-2, Word'de 2 görüntü + SEQ Şekil). `npm run build` antivirüs kilidiyle düştü (bilinen); `vite build` ile ayrıca denenmedi.
- **Ölçülen etki:** ölçülmedi (görsel tasarım, tüzük 4.7).
- **Bilinen eksikler:** galerinin diğer 20 şablonu; şekilde etiketten kaynak cümleye bağ (WO-016 eşleştirme) yok; PDF'e gömme ayrıca denenmedi; Word'deki SVG'nin yazı tipi sistemden (gömülü Noto yok, WO-008).
- **Sonraki adım:** Ahmet elle dener; hangi şablonların ekleneceğini galeriden seçer.
- **Durum:** NEEDS ATTENTION — elle deneme bekliyor.
