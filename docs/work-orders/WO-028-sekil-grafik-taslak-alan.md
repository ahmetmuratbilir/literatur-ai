# WO-028 — Şekil ve grafik: Napkin gibi belgede taslak alan, "Tamam" ile ekle

| Alan | Değer |
| --- | --- |
| Durum | Taslak (19.10.2026) — kapsam kullanıcı kararından; ayrıntı WO-026 sonrası netleşir |
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

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
