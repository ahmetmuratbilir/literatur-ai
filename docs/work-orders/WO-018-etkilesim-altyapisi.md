# WO-018 — Etkileşim altyapısı: katmanlar, Esc yığını, ortak pencere, geri al

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (17.10.2026, `wo-018-etkilesim`; kullanıcı onayı: MVP kapsamı) |
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
- **Değişen dosyalar:** yeni `client/src/components/ui/layerStack.js`,
  `useLayer.js`, `DialogProvider.jsx`, `dialogContext.js`,
  `client/tests/layerStack.test.js`, `client/e2e/layers.spec.js`; değişen
  `App.jsx`, `main.jsx`, `Toasts.jsx`, `ExportMenu.jsx`, `MethodologyModal.jsx`,
  `ShareModal.jsx`, `PaperReaderDrawer.jsx`, `HistorySidebar.jsx`,
  `AuthorPicker.jsx`, `hooks/useShare.js`, `workspace/Workspace.jsx`,
  `workspace/FormatPicker.jsx`, `workspace/SubmitPrep.jsx`,
  `workspace/OutlineNav.jsx`, stiller (`variables.css`, `ui.css`,
  `workspace.css`, `writer.css`, `states.css`, `landing.css`), `i18n/tr.js`,
  `i18n/en.js`, testler `e2e/mode.spec.js`, `e2e/kabul.spec.js`.
- **Teknik kararlar:**
  - Katman ölçeği `variables.css`'te (`--z-sticky` … `--z-fly`). Bildirim
    pencerenin üstünde (önceden 120 < 1000/9999: pencere açıkken "Geri al"
    görünmüyordu). **Sapma:** bileşenin kendi yığın bağlamındaki küçük
    sıralama (0–20; `.wx-pop`, `.wx-overlay`, kenar çubuğunun aç/kapa düğmesi,
    çekmecenin yapışkan başlığı) sayı kaldı — genel katman değil; hepsini
    değişkene çevirmek anlam katmadan dosya değiştirirdi (3.11).
  - Tek Esc dinleyicisi (`layerStack.js`, saf, birim testli); 7 belge
    dinleyicisi `useLayer`'a çevrildi. İki giriş alanı (araştırmacı önerileri,
    bölüm yeniden adlandırma) Esc'yi kendisi karşılıyor ve `preventDefault`
    ile yığına dokundurmuyor.
  - 6 tarayıcı kutusu kalktı: taslak silme onaysız + 8 sn "Geri al";
    yeniden adlandırma ürünün penceresinde (planın önerisi satır içi
    düzenlemeydi; pencere aynı odak ve geri dönüş kurallarını sağlıyor, satır
    içi düzenleme sadeleştirme turuna not); boş bölüm kaldırma, şablonu
    üstüne yazma, kaynakçanın üstüne yazma ürünün onay penceresinde,
    varsayılan düğme Vazgeç, "şimdilik geri alınamaz" notu; paylaşım hatası
    bildirimde.
  - Biçim değişiminde sıra değişti: biçim önce uygulanır, boş bölümleri
    kaldırmak ayrıca sorulur (pencere eşzamansız).
  - Bildirim üzerine gelince ya da odaklanınca süre durur; uyarı bildirimi
    `role="alert"`.
- **Testler:** istemci birim 319/319 (yeni `layerStack.test.js` 5); lint
  temiz; yeni `layers.spec.js` 5/5 (iki katmanda tek Esc yalnız üsttekini
  kapatır; 20 Tab odağı pencerede tutar, `#root` inert, Esc sonrası odak açan
  düğmede; değişiklik varken dışarı tıklama kapatmaz; üzerine gelinen "Geri
  al" 9 sn sonra hâlâ görünür; hiçbir akışta tarayıcı kutusu yok). Tam
  sonuçlar commit mesajında.
- **Bulgu:** eski "biçim değiştirme" testi kaldırma sorusunu bekliyordu ama
  o senaryoda soru hiç gelmiyordu (Playwright kutuyu sessizce geçiyordu);
  test artık sorunun gelmediğini, gidiş-dönüş testi ise tez → makale
  yönünde geldiğini ve Vazgeç'in odakta olduğunu doğruluyor.
- **Ölçülen etki:** envanter önce/sonra — tarayıcı kutusu 6 → 0; belge
  düzeyinde Esc dinleyicisi 7 → 1; genel katmanlar 13 farklı sayı → 9
  değişken.
- **Bilinen eksikler:** Masam'da "Son silinenler" (7 gün) yapılmadı (onay
  noktası); `@axe-core/playwright` yok (yeni bağımlılık).
- **Sonraki adım:** WO-021 (bekleme, hata, kart durumları).
- **Durum:** NEEDS ATTENTION — kriterler karşılandı, testler geçti; elle
  deneme MVP sonundaki bakışta.
