# WO-020 — Araştırmadan yazıma köprü

| Alan | Değer |
| --- | --- |
| Durum | Taslak (17.10.2026) |
| Kapsam | Çapraz (istemci + sunucuda tek alan) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1–2 oturum |
| Ön koşul | WO-017 (tek panel kabuk) bitti |
| Yol haritası aşaması | P1 — `docs/design/yol-haritasi.md` adım 6 |
| Dal | `wo-020-kopru`, WO-017 ucundan |
| Kaynak | `docs/design/etkilesim-ve-durumlar-plani.md` §9 (kararlar 16.10.2026, prototipte sınandı) |

## Problem
Yazarken bir iddianın kaynağını bulmak için kullanıcı araştırma ekranına
dönüp aramayı hatırlamak zorunda. Oysa ilgili makaleler çoğu zaman zaten
sepette ya da son aramalarda. Yaz ekranı bunları görmüyor.

## Neden şimdi
Tek panel kabuk (WO-017) araştırma ve yazımı aynı yüzeye getiriyor; köprü bu
birleşmenin kullanıcıya görünen karşılığı. Model gerektirmez, ucuzdur.

## Kapsam
### Dahil (§9.1–9.2'deki kararlar olduğu gibi)
- Yaz'da iddia cümlesi seçilip sağ panel açılınca "Son aramandan ilgili
  olabilir" kartları; **nötr görünüm, kanıt sınıfı rozeti yok** (2.4).
- Havuz: önce sepet, sonra son 3 arama; iki ayrı başlık; aynı makale bir kez.
- Eşleştirme tarayıcıda, model yok: Türkçe kaba gövde, sorguyla en az 2 ortak
  gövde (§9.3). Her kart neden orada olduğunu söyler (hangi arama, ne zaman,
  ortak kelimeler).
- Eylemler: "Atıf olarak ekle", "Özeti oku" ("Yalnız özet; tam metin
  okunmadı").
- Eklenen atıf **"doğrulanmadı"** işaretli (kesik amber alt çizgi + "?");
  Kontrol'de "Doğrulanmamış atıf" uyarısı.
- Atıf iddia cümlesinin kimliğine bağlanır; cümle silindiyse eklenmez.
- Geri çekilmiş kaynak listede kalır, atıf düğmesi kapalı ("Atıf önerilmez").
- Eşleşme yoksa: "Son 3 aramanda bu cümleyle eşleşen bir sorgu yok" +
  sorgu kutusu dolu "Araştırmada ara".
- Sepete eklenen makalenin hangi sorgudan geldiği (köken) saklanır.

### Hariç
- Kanıt doğrulama ("Kanıt bul", PR3) — WO-005.
- Gömme ya da PR1 ile genişletme (§9.1 karar 7'nin B/C yolları) — E1 ölçümü
  olmadan yapılmaz (4.1).

## Dokunulabilecek dosyalar
- `client/src/components/workspace/bridge.js` (yeni; saf eşleştirme), `client/src/components/workspace/BridgePanel.jsx` (yeni)
- `client/src/components/workspace/Workspace.jsx` (panel bağlantısı, atıf ekleme), `client/src/components/workspace/CheckPanel.jsx` (yeni uyarı)
- `client/src/components/workspace/citation.js` (yalnız "doğrulanmadı" işareti)
- `client/src/hooks/useBasket.js` (köken alanı), `client/src/App.jsx` (son 3 aramanın sonuçlarını bellekte tutma)
- `server/models/Basket.js` (isteğe bağlı `query` alanı), sepet uç noktası (alan geçişi)
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`, `client/src/styles/workspace.css`
- `client/tests/bridge.test.js` (yeni), `client/e2e/bridge.spec.js` (yeni), ilgili sunucu testi
- `docs/work-orders/README.md`, bu dosya

## Yaklaşım
- Son 3 aramanın sonuçları sunucuda saklanmaz: istemci zaten aldı, oturum
  belleğinde (sekme kapanınca gider) tutulur. `SearchHistory` sonuç saklamıyor
  (`server/models/SearchHistory.js`), saklatmak veri büyütür.
- Sepette köken: `Basket.source` bugün veri sağlayıcısı (`server/models/Basket.js:23`),
  sorgu değil. Yeni isteğe bağlı `query` (≤ 150) eklenir; eski kayıtlarda yok
  → kart "kaynağı: sepet" der, sorgu göstermez.
- Eşleştirme `bridge.js`'te saf fonksiyon; prototipteki kural ve eşik birebir.

## Kabul kriterleri
- [ ] Sepet ve son 3 arama ayrı başlıklarda; aynı makale bir kez (birim test).
- [ ] Kartlarda kanıt sınıfı rozeti yok; her kartta "neden burada" satırı.
- [ ] Eklenen atıf "doğrulanmadı" işaretli; Kontrol'de uyarı çıkıyor (e2e).
- [ ] Cümle silinince atıf eklenmiyor, mesaj çıkıyor (e2e).
- [ ] Geri çekilmiş kaynakta atıf düğmesi kapalı, kart görünür (e2e).
- [ ] Eşleşme yokken boş ekran yok; "Araştırmada ara" sorguyu dolu açıyor (e2e).
- [ ] Eski sepet kayıtları (`query` yok) hatasız (sunucu testi).
- [ ] Eşleştirmede ağ isteği yok (e2e ağ kaydı).
- [ ] Testler, lint, build geçiyor; Ahmet elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Eşleştirme | `npm test` (`bridge.test.js`) | Gövde, eşik, tekilleştirme, sıra |
| Akış | `npx playwright test bridge.spec.js` | Yukarıdaki e2e maddeleri |
| Sepet alanı | `server: npm test` | Eski/yeni kayıt |

## Ölçüm
**Ölçülmedi** yazılır: eşleştirmenin isabeti bilinmiyor (§9.3), E1 kümesi
yok. İzlenecek: atıf olarak eklenen öneri oranı (4.8).

## Geri alma
Faz başına commit; `BRIDGE_ENABLED` istemci bayrağı (CLAUDE.md 3.12'ye
eklenir). `query` alanı isteğe bağlı; geri alınırsa okunmaz, veri bozulmaz.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Kullanıcı nötr kartı "destekliyor" sanır | Orta | Tüzük 2.4 | Rozet yok, "doğrulanmadı" işareti, Kontrol uyarısı |
| Farklı kelimeyle aynı şeyi söyleyen iddia kaçar | Yüksek | Eksik öneri | Bilinen sınır, arayüz "eşleşme yok" der; B/C yolları ölçümle |

## Onay gereken noktalar
- `Basket` şemasına isteğe bağlı `query` alanı (tüzük kural 6: şema değişikliği).

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
