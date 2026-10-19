# WO-025 — Word gibi tablo: ızgaradan ekle, belgede düzenle, Word'e gerçek başlıkla

| Alan | Değer |
| --- | --- |
| Durum | Çalışıyor (19.10.2026) — kullanıcı onayı: geri bildirim listesi + "tmm komple yap" |
| Kapsam | Yazım yüzeyi + dışa aktarma |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1–2 oturum |
| Ön koşul | WO-019 Faz 1 (çekirdek `visuals/table.js`) |
| Yol haritası aşaması | P3 |
| Dal | `kaynak-sagligi` ucundan `wo-025-word-tablo` |
| Kaynak | Kullanıcı geri bildirimi 19.10.2026 (hafıza: tablo-word-gibi-geri-bildirim, madde 1–4, 9, 11); araştırma raporu (Word tablo davranışı, APA 7) |

## Problem
WO-019 Faz 1 tabloyu sağ panelde dar bir ızgarada düzenletiyordu. Kullanıcı:
"Word'deki gibi olsun: Tablo düğmesi, ızgaradan kaça kaçlık seçilir, tablo
belgede düzenlenir; başlıklandırma Word'deki gibi." Faz 1 arayüzü bayrakla
kapatıldı (`VISUALS_ENABLED=false`).

## Kapsam
### Dahil (MVP)
- **Tablo düğmesi** biçim çubuğunun solunda (belge yapısı düğmesinin boşalttığı
  yer): 10×8 ızgara, üzerine gelince "3 sütun × 4 satır", klavyeyle ok/Enter/Esc.
  Altında "Başlıkla ekle" (hatırlanır, varsayılan açık).
- **Yer:** imlecin paragrafının altı; imleç boş satırdaysa o satıra. Paragraf
  bölünmez (Word böler; bilerek bölmüyoruz).
- **Belgede düzenleme:** hücreye tıkla-yaz. Tab / Shift+Tab hücreler arası, son
  hücrede Tab yeni satır; Enter hücre içinde satır sonu; Alt+Shift+↑/↓ satırı
  taşır; hücre başında Backspace / sonunda Delete tabloyu yırtmaz.
- **Tablo araç çubuğu:** imleç tablodayken tablonun üstünde: üste/alta satır,
  sola/sağa sütun, satırı/sütunu sil, başlık satırı aç/kapa, sütun hizası,
  başlık ekle/kaldır, tabloyu sil.
- **Başlık (Word "Resim Yazısı Ekle"):** `<p class="wx-caption" data-caption-for>`
  içinde numara ayrı düğüm `<span data-seq="table" contenteditable="false">`;
  numara her değişiklikten sonra belgedeki sıraya göre yeniden hesaplanır,
  kullanıcının başlık biçimi bozulmaz.
- **Geri al:** her ekleme/değiştirme/silme tarayıcının kendi komutuyla
  (`execCommand('insertHTML')`), Ctrl+Z ile geri döner (ölçüldü 19.10.2026).
  Numara ve başlık bağı her girdiden sonra kendini onarır.
- **APA görünümü:** yalnız yatay çizgiler (üst, başlık satırı altı, alt).
- **Word'e:** başlık numarası Word'ün SEQ alanı (Word'de F9 ile güncellenir),
  başlık paragrafı tabloya yapışık (keepNext), başlık satırı her sayfada
  tekrarlanır (tableHeader), satır sayfa arasında bölünmez, APA kenarlıkları.

### Hariç (sonra)
- Hücre seçimi, birleştir/böl (colspan/rowspan) — WO-004 editör geçişinde
  `prosemirror-tables` ile.
- Sağ tık menüsü, + işaretiyle satır ekleme, sütun genişliği, tablo notu,
  çapraz başvuru ("Tablo 2'de" — Türkçe ek sorunu).
- Şekil ve grafik (Napkin gibi taslak alan) — ayrı iş emri.
- Sağ panel Görsel / TableEditor kodunun silinmesi (bayrak kapalı; temizlik ayrı).

## Dokunulabilecek dosyalar
- `client/src/visuals/table.js` (yalnız ekleme: başlık HTML'i, numara yardımcıları)
- `client/src/components/workspace/tableDom.js` (yeni: DOM klonu üzerinde satır/sütun işlemleri)
- `client/src/components/workspace/TableGridPicker.jsx` (yeni)
- `client/src/components/workspace/Workspace.jsx`, `OutlineNav.jsx` (boş metin)
- `client/src/components/workspace/exportDocument.js`
- `client/src/styles/workspace.css`, `client/src/i18n/tr.js`, `en.js`, `client/src/App.jsx` (bayrak)
- `client/tests/table.test.js`, `client/tests/tableDom.test.js` (yeni, jsdom yoksa saf kısımlar)
- `client/e2e/word-table.spec.js` (yeni)
- `CLAUDE.md` (3.12 bayrak satırı), `docs/work-orders/README.md`, bu dosya

## Kabul kriterleri
- [ ] Izgarada 3×4 seçilince belgede 3 sütun × 4 satır tablo, üstünde "Tablo N." başlığı, imleç ilk hücrede.
- [ ] Tab ile hücre gezme, son hücrede Tab yeni satır; Ctrl+Z ekleme ve satır eklemeyi geri alır.
- [ ] Araç çubuğuyla satır/sütun ekle-sil, başlık satırı, hiza, tablo sil çalışır; hücre içi kalın yazı korunur.
- [ ] Önüne tablo eklenince numaralar sıraya göre güncellenir; başlıktaki italik bozulmaz.
- [ ] Silme + Ctrl+Z sonrası başlık yine tabloya bağlı ve numaralı.
- [ ] Word çıktısında `w:tbl`, `SEQ Tablo` alanı, `w:tblHeader`, başlık paragrafında `w:keepNext`.
- [ ] Birim, lint, build, önceki e2e geçer.
- [ ] Ahmet elle denedi.

## Test planı
| Test | Nasıl | Beklenen |
| --- | --- | --- |
| Saf yardımcılar | `npm test` | başlık HTML'i, numara |
| Akış | `npx playwright test word-table.spec.js` | ızgara → yaz → Tab → araç çubuğu → geri al → Word |
| Elle | Izgaradan tablo ekle, doldur, Word'e aktar, Word'de aç | Word'de düzenlenebilir tablo, başlık Word'ün başlığı gibi |

## Ölçüm
Ölçülmeyecek: davranış e2e ile doğrulanır; kalite metriği yok (tüzük 4.7).

## Geri alma
`TABLES_ENABLED` istemci bayrağı (CLAUDE.md 3.12). Kapalıyken Tablo düğmesi ve
tablo araç çubuğu görünmez; belgedeki tablolar normal tablo olarak kalır. Commit
grubu tek hamlede `git revert` ile döner.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Chrome dışı tarayıcıda `insertHTML` farklı davranır | Orta | Geri al tutarsız | e2e Chromium; Firefox elle denenir, rapora yazılır |
| `contenteditable=false` numara düğümünde imleç takılır | Düşük | Başlık yazımı zor | Numara kendini onarır; elle deneme |
| Elle yazılmış "Tablo N." satırlarıyla SEQ numarası ayrışır | Orta | Word'de numara farkı | Kontrol `captionOrder` uyarısı zaten var |

## Onay gereken noktalar
Yok (kapsam kullanıcı geri bildiriminden). Şekil/grafik iş emri ayrıca.

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
