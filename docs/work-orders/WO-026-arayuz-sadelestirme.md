# WO-026 — Arayüz sadeleştirme: kenar çubuğu K1, yazım çubuğu Y1, arama A2

| Alan | Değer |
| --- | --- |
| Durum | Çalışıyor (19.10.2026) — kullanıcı kararı: "önerilen şekilde yapılacak", "başlayalım" |
| Kapsam | İstemci arayüzü (sunucu yok) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 4 faz, faz başına yarım–bir oturum |
| Ön koşul | WO-025 (`230c6d0`) |
| Yol haritası aşaması | P1 |
| Dal | `ui-sade` (`wo-025-word-tablo` ucundan); faz başına bir commit |
| Kaynak | Kullanıcı geri bildirimi 19.10.2026 (hafıza: tablo-word-gibi-geri-bildirim, devir-2026-10-19-gece); seçenek sayfası `research/design/options.html` (K1, Y1, P, A2, T3+T1) |

## Problem
- Kenar çubuğu "dolu dolu": koyu şerit, büyük dolu "Yeni arama" düğmesi, iri simgeler, taslak kartlarında 4 düğme + uzun uyarı varsayılan görünür.
- Yazım üst çubuğunda 8 eşit ağırlıklı öğe var; ürünün iki asıl işi (Atıf ekle, Dışa aktar) kalabalıkta kayboluyor.
- Sağ panel sekmelerinde uzun açıklama metinleri.
- Arama ana sayfası boş ve amaçsız; "AI ile geliştir" sonuçları birden beliriyor.

## Kapsam
### Faz 1 — Taslak satırları ve küçük simgeler (pipeline adım 1)
- Çalışmalarım'daki taslak: tek satır ad + "N kelime · tarih". Düzenle/çoğalt/indir/sil yalnız üzerine gelince ya da odakta, satırın sağında; satır büyümez. "Kaldığın bölüm" ipucuya (title) taşınır.
- Yerel kayıt uyarısı tek satır ("Yalnız bu tarayıcıda · yedek için ⤓"), tam metin ipucunda. Uyarı kalkmaz (2.8), küçülür.
- Kapalı ray: 72 → 60 px; öğe 40×38 px, simge 18 → 17 px; "Yeni arama" dolu mor kutu değil sade satır/simge (vurgu yalnız seçili öğede).

### Faz 2 — K1 kenar çubuğu (adım 2)
- Açık renk (beyaz zemin, `#e8ebf1` çizgi, vurgu `#4f46e5` yalnız seçili öğede `#eef0ff` zeminle); açık genişlik 248 px.
- Sıra: logo (aç/kapat) · Yeni arama (Ctrl K) · ayraç · Araştırma · Yaz · Çalışmalarım · Favoriler · Makalen için (kapalı gelir; tıklayınca listesi açılır, sayı rozeti) · boşluk · hesap satırı.
- Yapay zekâ bağlantıları ve Yardım hesap satırındaki ⋯ menüsüne taşınır (Esc ve dışarı tıklama kapatır, WO-018 katmanı).
- Ctrl K: Yeni arama (konu kutusuna odak). Kısayol arayüzde yazılı.

### Faz 3 — Y1 yazım çubuğu + P bilgi kartları (adım 3)
- Üst sıra (belge): ← Araştırma · başlık ve altında tıklanabilir bilgi satırı "APA 7 · A4 ▾ · Kaydedildi · N kelime" · sağda "Teslime hazırla" (+ sorun sayısı) ve tek dolu düğme "Dışa aktar".
- Alt sıra (yazı): Tablo · stil · yazı tipi/punto/aralık · B I U · hizala · liste · geri/ileri · sağ uçta vurgulu "Atıf ekle" ve "Ekle ▾", ⋯ (Şablon, Sayfa ayarları buraya).
- Alttaki durum çubuğundan kayıt durumu ve kelime sayısı başlık altına taşınır; durum çubuğunda yalnız görünüm seçici ve ölçek kalır.
- Sağ panel Kaynaklar / Asistan / Kontrol: her biri tek cümlelik kart + kaldırılamaz gri sınır etiketi ("Özetten · tam metin değil", "Atıf işaretini sayar · pasaj desteğini değil") + katlanır "Nasıl çalışır?".

### Faz 4 — A2 arama ana sayfası + T3/T1 geçişi (adım 4)
- Ortada logo + ad + arama kutusu (Ara ve AI ile geliştir kutunun içinde/yanında), sade.
- Altında "kaldığın yer" kutucukları kullanıcının KENDİ verisinden: son taslak (adı, kelime, ne zaman), son 3 arama, Makalen için sayısı. Veri yoksa kutucuk gösterilmez; ilk kez gelen kullanıcıya "örnek" etiketli 4 konu çipi. Uydurma sayı/istatistik yok (2.8).
- "AI ile geliştir": istek sürerken iskelet satırlar (gerçek bekleme), yanıt gelince satırlar ~80 ms arayla oturur. Sahte "düşünüyor" aşaması yok; hareket azaltmada animasyonsuz.

### Hariç
- Koyu tema (ayrı iş); mobil kenar çubuğunun yeni tasarımı (mevcut çekmece davranışı korunur, yalnız renkler K1'e uyar).
- Komut paleti (Ctrl K yalnız yeni aramaya odaklar).
- Arama sonuç kartlarının tasarımı.

## Dokunulabilecek dosyalar
- `client/src/components/HistorySidebar.jsx`, `client/src/styles/sidebar.css`
- `client/src/components/workspace/Workspace.jsx`, `CheckPanel.jsx`, `client/src/styles/workspace.css`
- `client/src/App.jsx`, `client/src/components/AiAnalysisPanel.jsx`, `client/src/styles/ui.css`
- yeni: `client/src/components/HomeResume.jsx` (A2 kutucukları), `client/src/components/AccountMenu.jsx`
- `client/src/i18n/tr.js`, `en.js`
- e2e: `mode.spec.js`, `layers.spec.js`, `shell.spec.js`, `support.spec.js`, `write.spec.js`, `kabul.spec.js` (yalnız değişen seçiciler); yeni `ui-sade.spec.js`
- `docs/work-orders/README.md`, bu dosya

## Yaklaşım
- Her faz önce ekran görüntüsüyle (1440 ve 390 px) karşılaştırılır, sonra commit.
- Var olan `data-action` / `data-testid` adları korunur; testler davranışa bakar. Taşınan öğede (ör. yardım hesap menüsüne) test yeni yolu izler.
- Renkler değişken üzerinden (`--sb-*`), tek yerde.

## Kabul kriterleri
- [ ] F1: taslak satırı tek satır; düğmeler varsayılan görünmez, üzerine gelince/odakta görünür; uyarı tek satır, `drafts-local-warn` görünür. Ray 60 px.
- [ ] F2: kenar çubuğu açık renk; 7 ana satır; bağlantılar ve yardım ⋯ menüsünden açılır, Esc kapatır; Ctrl K konu kutusuna odaklar.
- [ ] F3: üst sırada tek dolu düğme (Dışa aktar); başlık altı bilgi satırı biçim seçiciyi açar; kayıt durumu oraya taşındı; sağ panel kartları tek cümle + sınır etiketi.
- [ ] F4: ana sayfada kullanıcı verisi yoksa kutucuk yok, "örnek" çipler var; veri varken son taslak/aramalar doğru; AI geliştirmede iskelet → satırlar sırayla.
- [ ] Her fazda: lint temiz, birim geçer, e2e geçer (seçici değişenler güncellenir), 390 px'te yatay taşma yok.
- [ ] Ahmet elle denedi.

## Test planı
| Test | Nasıl | Beklenen |
| --- | --- | --- |
| Akışlar | `npx playwright test ui-sade.spec.js` + etkilenen spec'ler | yukarıdaki kriterler |
| Görsel | betikle 1440/390 ekran görüntüsü | taşma yok, hiyerarşi Y1/K1 gibi |
| Tam | `npm run kontrol` | birim, lint, sunucu, e2e |

## Ölçüm
Ölçülmeyecek: görsel tasarım (tüzük 4.7); davranış e2e ile doğrulanır.

## Geri alma
Faz başına commit; `git revert <commit>`. Renk değişkenleri tek yerde olduğu için K1 → koyu dönüş tek dosya.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Testler eski yerleşime bağlı | Yüksek | Kırmızı e2e | Seçiciler `data-action` ile; değişen yol testte güncellenir |
| Yardım bir tık derine gider | Orta | Bulunamaz | Kapalı rayda ? simgesi kalır |
| Şablon ⋯ içine girer | Orta | Yeni belgede bulunmaz | Biçim seçici zaten açılışta; boş sayfada şablon kısayolu duruyor |

## Onay gereken noktalar
Yok (kararlar verildi). Koyu temaya dönüş istenirse renk değişkenleri.

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
