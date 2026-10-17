# WO-018 — Etkileşim altyapısı: katmanlar, Esc yığını, ortak pencere, geri al

| Alan | Değer |
| --- | --- |
| Durum | Taslak (17.10.2026) |
| Kapsam | Çapraz (istemci) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1–2 oturum |
| Ön koşul | WO-017 bitti |
| Yol haritası aşaması | P1 |
| Dal | `wo-018-etkilesim`, WO-017 ucundan |
| Kaynak | `docs/design/etkilesim-ve-durumlar-plani.md` §1, §6, §7 (planda adı WO-E1) |

## Problem
Envanter (planın §0, 16.10.2026): 26 ayrı z-index değeri, 9 ayrı Esc
dinleyicisi, 6 tarayıcı kutusu. Tarayıcı kutuları bugün:

- `client/src/App.jsx:650` `window.prompt` (taslak adı)
- `client/src/App.jsx:667` `window.confirm` (taslak sil)
- `client/src/components/workspace/Workspace.jsx:890` `confirm` (boş bölüm kaldırma)
- `Workspace.jsx:918` `confirm` (şablonu metnin üstüne uygulama)
- `Workspace.jsx:1168` `confirm` (kaynakçanın üstüne yazma)
- `client/src/hooks/useShare.js:48` `alert` (paylaşım hatası)

Sonuç: iki katman açıkken Esc ikisini birden kapatabiliyor, pencere arkası
odak alıyor, onay kutuları ürünün dilinde değil.

## Neden şimdi
Çizici (WO-019), köprü ve bekleme ekranları ortak pencereyi ve geri al
bildirimini kullanacak. Önce bu altyapı gelmezse her biri kendi penceresini
yazar ve envanter büyür.

## Kapsam
### Dahil
- §1.1 katman ölçeği: `--z-base` … `--z-tooltip` değişkenleri; kodda sayı
  yerine değişken.
- §1.2 katman yığını: tek `keydown` dinleyicisi; Esc yalnız en üsttekini
  kapatır; yazı alanında Esc metni değiştirmez.
- §1.3 ortak pencere bileşeni: odak hapsi, arka plan `inert`, açılışta ilk
  alana odak, kapanışta açan düğmeye dönüş, değişiklik varken dışarı
  tıklamayla kapanmama.
- Bildirim kuyruğu: geri al (8 sn, üzerine gelince durur, klavyeyle
  odaklanır), en fazla 3.
- 6 tarayıcı kutusunun §6 tablosuna göre kaldırılması.

### Hariç
- Bekleme, hata ve kart durumları (WO-E2).
- `@axe-core/playwright` (yeni bağımlılık; ayrı onay).
- Masam'da "Son silinenler" listesi (§6 öneriyor; ayrı karar).

## Dokunulabilecek dosyalar
- `client/src/styles/variables.css` ve z-index yazan stil dosyaları (`base.css`, `components.css`, `sidebar.css`, `states.css`, `ui.css`, `workspace.css`, `writer.css`, `landing.css`)
- `client/src/components/ui/Dialog.jsx`, `client/src/components/ui/layerStack.js`, `client/src/components/ui/ConfirmDialog.jsx` (yeni)
- `client/src/components/Toasts.jsx`
- `client/src/App.jsx`, `client/src/components/workspace/Workspace.jsx`, `client/src/hooks/useShare.js` (yalnız tarayıcı kutuları ve Esc dinleyicileri)
- Esc dinleyicisi taşıyan bileşenler (envanter §0.2'deki 9 yer; uygulama başında listelenir)
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/tests/layerStack.test.js` (yeni), `client/e2e/layers.spec.js` (yeni)
- `docs/work-orders/README.md`, bu dosya

## Yaklaşım
Planın §1–§6'sı olduğu gibi uygulanır; yeni mimari kararı yok. Katman
yığını saf modül (`layerStack.js`), birim testli; React tarafı ince sarmalayıcı.

## Kabul kriterleri
- [ ] `grep -rnE "confirm\(|prompt\(|alert\(" client/src` boş.
- [ ] Stillerde sayı ile yazılmış z-index yok; hepsi `var(--z-…)`.
- [ ] Tek Esc dinleyicisi; iki katman açıkken bir Esc yalnız üsttekini kapatır (Playwright).
- [ ] Pencerede 20 kez Tab: odak dışarı çıkmaz; kapanınca odak açan düğmede (Playwright).
- [ ] Taslak silme onay sormadan yapılır ve "Geri al" ile geri gelir (Playwright).
- [ ] Geri alınamayan iki eylem (boş bölüm kaldırma, şablonu üstüne uygulama) ürünün onay penceresiyle; varsayılan düğme "Vazgeç".
- [ ] İstemci birim testleri, lint, build ve önceki e2e testleri geçiyor.
- [ ] Ahmet yerelde elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Katman yığını | `npm test` (`layerStack.test.js`) | Ekle/çıkar/en üst/Esc kuralları |
| Katman ve odak | `npx playwright test layers.spec.js` | §7'nin ilk dört satırı |
| Regresyon | `npx playwright test` | Önceki sayı geçiyor |

## Ölçüm
Ölçülmeyecek (kalite metriği yok). Envanter sayıları önce/sonra raporlanır:
z-index değeri sayısı, Esc dinleyicisi sayısı, tarayıcı kutusu sayısı.

## Geri alma
Faz başına commit; dal `git revert` ile geri alınır. Veri değişikliği yok.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Editörde Esc başka davranışı bozar | Orta | Yazı kaybı | Yazı alanı kuralı + e2e |
| `inert` eski tarayıcıda yok | Düşük | Arka plan odak alır | Odak hapsi zaten var; `inert` ek katman |

## Onay gereken noktalar
- "Son silinenler" (7 gün) Masam'a eklensin mi.

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
