# WO-010 — Uygulama kabuğu ve yeni tasarıma geçiş (Aşama 0–2)

| Alan | Değer |
| --- | --- |
| Durum | Bitti — Döngü C (kullanıcının elle denemesi) bekliyor. "start" 14.10.2026 |
| Kapsam | İstemci: kabuk, Kaynaklar, Alanım, Yazım Stüdyosu, Denetim ve Teslim |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 4–6 oturum |
| Ön koşul | Bekleyen yerel iş commit edilmiş olmalı (bkz. Öneri 1) |
| Tasarım kaynağı | Stitch ekranları 1, 2, 6 + tasarım sistemi belgesi (14.10.2026) |
| Yol haritası aşaması | P1 (arayüz) — yeni hesap ya da kaynak eklemiyor |

## Problem

Uygulama üç ayrı düzenden oluşuyor ve bunlar birbirini tanımıyor:

1. **Arama ekranı:** 280 px mor kenar çubuğu, üst çubuk, ortada sekmeler
   ("Literatür ara / Araştırmacı ara"), sağ kenarda yüzen sayaçlı "Yazar modu"
   düğmesi.
2. **Araştırmacı paneli:** arama ekranının içinde, sekmeyle açılıyor.
3. **Yazar modu:** `document.body`'ye çizilen ayrı, tam ekran bir yüzey. Kendi
   üst çubuğu ve "Aramaya dön" düğmesi var.

Stitch tasarımları bunları tek bir kabukta topluyor: solda dar ray, üstte
proje çubuğu, açık çalışma sekmeleri, modül başına kendi yerleşimi. Bu iş
emri o kabuğu kuruyor ve bugün çalışan **her** düğmeye yeni bir yer buluyor.
Hiçbir işlev kaybolmuyor; kaybolacaksa önce soruluyor.

## Alınan kararlar

Kullanıcı kararları ajana bıraktı (14.10.2026). Hepsi geri alınabilir.

| # | Karar | Gerekçe |
| --- | --- | --- |
| K1 | **Renkler bugünkü gibi kalıyor.** Tasarımın renkleri `--la-*` adlı CSS değişkenlerine bağlanıyor, değerleri mevcut paletten geliyor | Kullanıcı: "renkler çok önemli değil, revize edilebilir". Sonradan değiştirmek tek dosyada iş |
| K2 | **Literatür arama ve Araştırmacı paneli "Kaynaklar" modülüne giriyor** | Tasarımın rayında yoklar, ama bugün ürünün giriş kapısı onlar. Bul, sepete ekle, kütüphanede gör tek modülde akıyor |
| K3 | **Ray her modülde kalıyor (56 px). Yazımda ayrıca "Odak modu" var:** ray ve sekmeler gizleniyor, tek tuşla geri geliyor | Kullanıcının istemediği şey 280 px'lik mor geçmiş paneliydi; o tamamen kalkıyor. 56 px ray sade. Odak modu eski isteği karşılıyor |
| K4 | **Yalnız çalışan modüller rayda görünüyor.** Analiz ve Görseller, yapılana kadar rayda yok | Tasarım belgesinin kendi kuralı: çalışmayan şeyi çalışıyor gibi gösterme |
| K5 | **Yeni kabuk bayrak arkasında:** `APP_SHELL_ENABLED`. Kapalıyken bugünkü arayüz aynen çalışıyor | Geri dönüş tek satır; iki arayüz yan yana karşılaştırılabiliyor |
| K6 | **Paylaşılan bağlantılar (`?share=`) eski düzende kalıyor** | Giriş yapmamış ziyaretçiye uygulama kabuğu göstermenin anlamı yok |
| K7 | **Tasarımdaki gösterişli ama çalışmayan öğeler gerçeğe çevriliyor** (aşağıdaki tablo). Yerleri korunuyor, içerik doğru | Tüzük 2.2, 2.6, 2.8 |
| K8 | **Çalışma sekmeleri ilk sürümde modül oturumları:** "Taslak", "Arama: <konu>", "Araştırmacı: <ad>", "Denetim" | Tek belgemiz var; çoklu belge ayrı iş (Öneri 6). Sekmeler yine de durum korumayı ve hızlı geçişi sağlıyor |

## Geriye dönük envanter: bugünkü her öğe yeni tasarımda nereye gidiyor

Kaynak: kod okundu (`App.jsx`, `HistorySidebar.jsx`, `AppTopBar.jsx`,
`ResultCard.jsx`, `PaperReaderDrawer.jsx`, `Workspace.jsx`), 14.10.2026.

### Kabuk ve gezinme

| Bugün | Nerede | Yeni yeri | İşlem |
| --- | --- | --- | --- |
| Mor kenar çubuğu, 280/72 px (`HistorySidebar`) | Sol | **Kalkıyor**; içeriği aşağıdaki satırlara dağılıyor | Bayrak açıkken çizilmez |
| "Yeni arama" | Kenar çubuğu üstü | Kaynaklar › Literatür ara › "Yeni arama" + `Ctrl+K` | Taşınır |
| Geçmiş (aramalar, silme) | Kenar çubuğu sekmesi | **Alanım › Son aramalar** | Taşınır |
| Favoriler | Kenar çubuğu sekmesi | **Kaynaklar › Favoriler** | Taşınır |
| Sepet (liste, çıkar, temizle, BibTeX/RIS/CSV dışa aktar, "Yazmaya geç") | Kenar çubuğu sekmesi | **Kaynaklar › Sepetim (n/30)** | Taşınır |
| Kayıtlı AI analizleri | Kenar çubuğu sekmesi | **Alanım › Kayıtlı analizler** | Taşınır |
| "Ücretsiz plan" etiketi, daralt/genişlet | Kenar çubuğu altı | Kullanıcı menüsü / ray her zaman dar | Taşınır / gereksiz |
| Üst çubuk: dil seçici | `AppTopBar` | Yeni üst çubuk, sağ | Taşınır |
| Üst çubuk: "Sistem" (yalnız yönetici) | `AppTopBar` | Kullanıcı menüsü › Sistem durumu | Taşınır |
| Mobil menü düğmesi | `AppTopBar` | 768 px altında ray, alt gezinme çubuğuna dönüşür | Değişir |
| Büyük "Literatür AI" başlığı | Arama sayfası üstü | Üst çubukta logo | Taşınır |
| "Literatür ara / Araştırmacı ara" sekmeleri | Arama sayfası | Kaynaklar modülünün alt sekmeleri | Taşınır |
| Yüzen "Yazar modu" düğmesi (sayaçlı, `WriterDock`) | Sağ kenar | Raydaki Yazım + Kaynaklar rozetinde sepet sayısı | **Kalkıyor** |
| Yazar modunda "Aramaya dön" | Yazım üst çubuğu | Ray (Kaynaklar) ya da "Arama" sekmesi | Kalkıyor, ray karşılıyor |
| Yazar modunun `body`'ye tam ekran çizilmesi | Portal | Kabuğun ana alanında, gömülü | Değişir (`embedded` modu) |

### Literatür arama (Kaynaklar › Literatür ara)

| Bugün | Yeni yeri |
| --- | --- |
| Konu kutusu, "AI ile geliştir", Ara | Aynen; modül başlığının altında |
| Yükleme göstergesi, AI arama stratejisi paneli | Aynen |
| Sonuç araç çubuğu: "Yazar modu", Dışa aktar (PDF/CSV/DOCX/BibTeX/RIS), Paylaş | "Taslağa geç" (Yazım sekmesini açar), Dışa aktar, Paylaş |
| Fikir birliği özeti, yayın zaman çizelgesi, filtre çipleri | Aynen |
| Sonuç kartı: Makalene ekle, Oku, Benzerini bul, BibTeX kopyala | Aynen |
| Daha fazla göster, YÖK Tez kutusu | Aynen |
| Okuma çekmecesi (`PaperReaderDrawer`) | Aynen, sağdan açılır. Tam PDF okuyucu Aşama 4 |
| Demo verisi uyarısı, kısmi ilgililik uyarısı | Aynen. **Bunlar dürüstlük uyarısı, kaldırılmaz** |

### Araştırmacı paneli (Kaynaklar › Araştırmacı)

Tamamı aynen taşınır: arama, kurum notu, aday listesi, "gizlenen N kişi —
göster", yayın listesi, geri çekme rozetleri. Panel bugün de gizlenip
korunuyor (`hidden`); kabukta aynı desen sürer.

### Yazar modu → Yazım Stüdyosu

| Bugün | Yeni yeri | İşlem |
| --- | --- | --- |
| Belge başlığı, kayıt durumu | Yazım alt başlığı (breadcrumb satırı) | Taşınır |
| Şablonlar menüsü | Alt başlık › Şablonlar | Aynen |
| Dışa aktar menüsü (Word, Yazdır) | Üst çubuk "Dışa aktar" + Denetim › Teslim paneli | İki yerden erişilir |
| Bağlam paneli aç/kapa | Alt başlık sağ | Aynen |
| İç ray: Bölümler / Kaynaklar | **Sol 240 px "Belge yapısı"** (bölüm ağacı). Kaynak listesi sağ panele geçer | Bölünür |
| "Dosyadan aktar" (Zotero/Mendeley) | Sağ panel › Kaynaklar + Kaynaklar › Sepetim | İki yerden |
| Biçim şeridi: stil, kalın, italik, altı çizili, hizalama, listeler, geri al/yinele | Tek satır araç çubuğu | Aynen |
| Sayfa ayarları menüsü (boyut, kenar, yazı tipi, punto, satır aralığı) | Araç çubuğu › Sayfa. Yazı tipi ve punto araç çubuğunda ayrıca görünür | Genişler |
| Taslak / Teslim görünümü | Durum çubuğunda: "Taslak · Teslim" + **Sayfaya sığdır / Gerçek boyut** | Genişler |
| Durum çubuğu: cümle, atıflı, atıfsız (→ inceleme), iddia değil (→ inceleme), bilgi, kelime | Alt durum çubuğu | Aynen |
| Kaldığın yer kartı | Belge üstü | Aynen |
| İnceleme listesi + vurgu | Sağ panelde, açık incelemeyken | Aynen |
| Sağ panel "Kaynak": künye, rozetler, pasaj, "Atıflı cümle üret", Benzerini/Yenisini üret, destek rozeti, "Metne ekle", "Alıntı olarak ekle" | Sağ panel › **Kanıt** sekmesi (tasarımdaki "Asistan"ın yeri) | Aynen, adı değişir |
| Sağ panel "Kaynakça": stil, kapsam, liste, "Belgeye yaz", tutarlılık kontrolleri | Sağ panel › **Kaynakça** sekmesi. Kontroller **Denetim**'e de yansır | Aynen |
| Kaynak gezgini (önceki / sonraki kaynak) | Sağ panel › Kanıt başlığı | Aynen |

### Bayrak arkasında kapalı duranlar — dokunulmuyor

`VERIFY_MODE_ENABLED` (Kaynakçanı doğrula), `AI_WRITER_PANEL_ENABLED` (eski
AI Yazar paneli). Kapalı kalırlar; yeni kabukta yerleri yok. Açılırlarsa
Kaynaklar'ın alt sekmesi olurlar.

## Tasarımdaki öğeler: neyi gerçeğe çeviriyoruz

| Tasarımda | Yerine | Tüzük |
| --- | --- | --- |
| "Buluta senkronize edildi" (yeşil, yanıp sönen) | Gerçek durum: "○ kaydedilmedi / ◐ bu cihazda · 14:32" | 2.8 |
| Asistan: "Akademik dille yaz", "Genişlet", "Metni değiştir", sohbet kutusu, "Kalan kredi" | **Kanıt** sekmesi: pasajdan tek cümle, destek rozeti, Benzerini/Yenisini üret | 2.2 |
| "%98 Doğruluk", "Güven skoru %96" | Destek sınıfı: şekil + ad + "otomatik kontrol, ölçülmüş doğruluk değil" | 2.8 |
| Kaynak yanında "AHP: 0.89" | Kaldırılır; AHP sıralama sinyali, kalite değil | 2.6 |
| "Hakem onaylı", "Doğrulanmış DOI" rozetleri | "DOI var", "Özet var" (kayıt bilgisi, yargı değil) | 2.8 |
| Denetim: "Genel hazırlık skoru %94" | Sayılar: "3 kritik · 5 öneri · 12 tamam" | 2.8 |
| "YÖK ve İTÜ kriterlerine göre" | "Seçili sayfa ayarlarına göre". Kurum şablonu kuralları ayrı iş (Öneri 9) | 2.8 |
| Doğrulanmamış iddia: "kaynak tam metninde bu değer yok" | "Atıf işareti olmayan iddia cümlesi". Tam metne erişimimiz yok; pasaj doğrulaması WO-005 | 2.8 |
| PDF/A, LaTeX zip, Turnitin %4 | Word (.docx), Yazdır/PDF, BibTeX/RIS. Olmayanlar listelenmez | 2.8 |
| Bildirim zili, sürüm geçmişi düğmesi, Paylaş (belge), Yorumlar | Gösterilmez (arka ucu yok). Aşama 6'da gelir | 2.8 |
| Yüzen "Hızlı Literatür Asistanı" | Gösterilmez. Yerine `Ctrl+K` komut paleti (Öneri 3) | 2.2 |
| "Hakem simülasyonu", "Sentezle", "Taslağa ekle" | Gösterilmez | 2.2 |

## Sayfalar ve geçişler

### Modüller

| Ray | Modül | İçerik | Aşama |
| --- | --- | --- | --- |
| ⌂ | **Alanım** | Taslak kartı ("Devam et"), son aramalar, kayıtlı analizler, sepet özeti | 0 |
| ✎ | **Yazım** | Yazım Stüdyosu | 0 (taşıma) → 1 (tasarım) |
| 📚 | **Kaynaklar** | Literatür ara · Araştırmacı · Sepetim · Favoriler | 0 |
| ✓ | **Denetim** | Kontrol listesi + teslim paneli | 2 |
| ⚙ | Ayarlar (ray altı) | Dil, sistem (yönetici), kullanıcı | 0 |

### Geçiş tablosu

Her satır ayrı test edilir (aşağıda Döngü C).

| Nereden | Eylem | Nereye | Korunması gereken durum |
| --- | --- | --- | --- |
| Herhangi | Ray tıklaması | İlgili modül | Önceki modülün tüm durumu (sonuçlar, kaydırma, imleç) |
| Kaynaklar › Ara | Sonuç kartında "Makalene ekle" | (yerinde) | Ray rozeti ve Yazım'daki kaynak listesi anında güncellenir |
| Kaynaklar › Ara | "Taslağa geç" | Yazım | Arama sonuçları silinmez; "Arama" sekmesi açık kalır |
| Kaynaklar › Sepetim | "Yazmaya geç" | Yazım, ilk kaynak sağ panelde | — |
| Kaynaklar › Ara | "Oku" | Okuma çekmecesi | Sonuç listesi yerinde |
| Alanım | Son aramaya tıkla | Kaynaklar › Ara, arama yeniden çalışır | — |
| Alanım | Yazar aramasına tıkla | Kaynaklar › Araştırmacı | — |
| Alanım | Taslak kartı › "Devam et" | Yazım, kalınan bölüme kaydırılmış | Kaldığın yer |
| Yazım | Sağ panel › Kaynaklar › "Kaynak bul" | Kaynaklar › Ara | Belge, imleç, açık taslak cümleleri |
| Yazım | Durum çubuğu › atıfsız | Sağ panelde inceleme listesi | — |
| Denetim | Bir uyarıda "Metinde göster" | Yazım, cümleye kaydırılmış ve parlatılmış | Denetim listesi; geri dönünce aynı yerde |
| Denetim | "Teslim önizlemesi" | Yazım, Teslim görünümünde | — |
| Denetim | "Word olarak indir" | (yerinde, dosya iner) | — |
| Yazım | Odak modu | Ray ve sekmeler gizlenir | `Esc` ya da aynı tuş geri getirir |
| Herhangi | Tarayıcı geri tuşu | Önceki modül | Hash yönlendirme (Öneri 2) |
| Herhangi | Sayfa yenileme | Aynı modül | Hash yönlendirme |
| Çalışma sekmesi | Kapat (Arama) | Sonuçlar temizlenir; onay sorulmaz, geçmişte kalır | — |
| Çalışma sekmesi | Kapat (Taslak) | Yalnız sekme kapanır; belge bu cihazda durur | Belge |

### Yerleşim kuralları (tasarımdan)

- Ray 56 px, üst çubuk 48 px, çalışma sekmeleri 36 px.
- Yazım: belge ağacı 240 px. **Sağ panel açılınca önce belge ağacı kapanır**;
  alan yine yetmiyorsa sayfa "sığdır" ölçeğine geçer. Kullanıcı "Gerçek boyut"
  seçerse yatay kaydırma kabul edilir.
- A4'ün ekrandaki genişliği sabit piksel değil, kullanılabilir alana göre
  hesaplanır (brief, 2. bölüm).
- 1280 px altında sağ panel üstü örten katman olur; 1024 px altında belge
  ağacı da. 768 px altında ray alta iner.

## Kontrol döngüleri

Üç katman. Bir katman kırmızıysa bir üst katmana geçilmez.

### Döngü A — her değişiklikten sonra (otomatik, dakikalar)

| Kontrol | Komut | Durma koşulu |
| --- | --- | --- |
| Lint | `cd client && npm run lint` | Tek hata |
| İstemci testleri | `cd client && npm test` | Bugünkü 94 testten biri düşerse |
| Çeviri anahtarları | `npm run check-i18n` | Bilinen `criteria.` dışında yeni sorun |
| Build | `npm run build` | Başarısız |
| Sunucu testleri | `cd server && npm test` | Yalnız sunucuya dokunulduysa |

### Döngü B — her 2–3 işte bir (otomatik + çıktı okuma)

1. **Sunucu tarafı render dumanı.** Kabuk her modülle `react-dom/server` ile
   render edilir (WO-003'te kurulan esbuild yolu). Çökme yok, beklenen
   başlıklar var.
2. **Düğme envanteri testi.** Yukarıdaki envanter tablosu bir test dosyasına
   çevrilir: her eski eylemin yeni yerinde bir `data-action` kimliği olmalı.
   Kimlik eksikse test düşer; "bu düğme nereye gitti" sorusu elle değil
   testle cevaplanır.
3. **Bayrak kapalıyken eski arayüz** aynı testlerle render edilir. İki
   arayüz de yeşil olmalı.
4. **Dürüstlük taraması.** Yeni metinlerde yasak kalıplar aranır:
   `senkronize`, `güven skoru`, `doğruluk %`, `hakem onaylı`, `AHP:`,
   `%\d+ hazır`. Eşleşme varsa durulur.

### Döngü C — her aşama sonunda (kullanıcıyla)

1. Yerelde açılır, ajan tarayıcıda gezinmenin listesini verir.
2. **Kullanıcı kontrol listesi:** geçiş tablosundaki her satır ve envanterdeki
   her taşınan düğme. Ajan listeyi hazırlar, kullanıcı tıklar.
3. Kullanıcı "tamam" demeden sonraki aşamaya geçilmez. Kullanıcının elle
   denemediği arayüz `main`'e alınmaz (CLAUDE.md 1).

### Durma kuralları

- Bir eski işlev için yeni yer bulunamazsa: dur, sor. Sessizce düşürülmez.
- Döngü A'da aynı hata üç denemede düzelmezse: dur, raporla.
- Tasarım ile tüzük çatışırsa tüzük kazanır, çatışma rapora yazılır.

## Aşamalar

### Aşama 0 — Kabuk (2 oturum)

| Adım | İş | Döngü |
| --- | --- | --- |
| 0.1 | `APP_SHELL_ENABLED` bayrağı, `client/src/shell/` iskeleti: ray, üst çubuk, çalışma sekmeleri, ana alan. `--la-*` değişkenleri. Eski arayüz ana alanın içinde, değişmeden | A |
| 0.2 | Hash yönlendirme (`#/kaynaklar/ara`, `#/yazim` …), geri tuşu, yenileme | A |
| 0.3 | **Kaynaklar** modülü: arama, Araştırmacı, Sepetim, Favoriler. Bayrak açıkken mod sekmeleri ve `WriterDock` çizilmez | A + B |
| 0.4 | **Alanım** modülü: son aramalar, kayıtlı analizler, taslak kartı. Bayrak açıkken `HistorySidebar` çizilmez | A |
| 0.5 | **Yazım** kabuğa gömülür (`embedded`, portal yok). Odak modu. Sekmeler arası durum korunur | A + B |
| — | Aşama sonu | **C** |

### Aşama 1 — Yazım Stüdyosu (1–2 oturum)

| Adım | İş | Döngü |
| --- | --- | --- |
| 1.1 | Yerleşim: 240 px belge ağacı, tek satır araç çubuğu, sağ panel sekmeleri (Kanıt · Kaynaklar · Kaynakça), otomatik daraltma kuralı | A |
| 1.2 | "Sayfaya sığdır / Gerçek boyut", durum çubuğu düzeni | A |
| 1.3 | Araç çubuğunda "Atıf ekle" (aktif kaynağın metin içi atfı imlece), yazı tipi ve punto | A + B |
| 1.4 | Seçim araç çubuğu: "Atıf ekle", "İddia / iddia değil". "Atıf doğrula" WO-005'e kadar yok | A + B |
| — | Aşama sonu | **C** |

### Aşama 2 — Denetim ve Teslim (1–2 oturum)

| Adım | İş | Döngü |
| --- | --- | --- |
| 2.1 | `client/src/audit/audit.js`: saf kurallar + testler (WO-006 deseni). Kurallar aşağıda | A |
| 2.2 | Denetim sayfası: önem derecesine göre liste, "Metinde göster" köprüsü | A + B |
| 2.3 | Teslim paneli: Word, Yazdır/PDF, BibTeX/RIS, "Teslim önizlemesi" | A + B |
| — | Aşama sonu | **C** |

**Denetim kuralları — yalnız elimizdeki veriyle:**

| Kural | Önem | Veri kaynağı (bugün var) |
| --- | --- | --- |
| Geri çekilmiş kaynağa atıf | Kritik | `/api/retractions` |
| Sepette karşılığı olmayan atıf | Kritik | `references.js` `orphans` |
| Kaynakça bölümü yok ya da metindeki atıflarla güncel değil | Kritik | `lastBibRef` + eşleşme |
| Atıf işareti olmayan iddia cümlesi | Uyarı | `claimDetection.js` |
| Doğrudan alıntıda sayfa numarası yok (tırnaklı metin + `(Yazar, Yıl)`, "s."/"p." yok) | Uyarı | **Yeni, küçük kural** |
| Şablon bölümü boş | Uyarı | `outline.js` |
| Bölüm kelime hedefinin çok altında / üstünde | Bilgi | `outline.js` |
| Atıf yapılmayan sepet kaynağı | Bilgi | `references.js` `uncited` |
| Geri çekme durumu bilinmiyor | Bilgi | `/api/retractions` `unknown` |
| Seçili sayfa düzeni özeti (A4, kenar, yazı tipi) | Bilgi | `pageSetup.js` — kurum kuralı iddiası yok |

Tablo/şekil numaralandırma kuralı yok: belgede şekil nesnesi yok.

### Sonraki aşamalar — bu iş emrinde değil

| Aşama | İş | Ön koşul |
| --- | --- | --- |
| 3 | Analiz Merkezi: elle literatür matrisi + istatistik paneli | WO-007 (WO-006/009 hazır) |
| 4 | Kaynak Kütüphanesi + PDF okuyucu | Tasarımı Stitch'te henüz üretilmedi |
| 5 | Görsel Stüdyo | Tuval kütüphanesi onayı (aday: React Flow, MIT) |
| 6 | İş birliği, yorumlar, sürümler | Sunucuda belge saklama + WO-004 (TipTap) |

## Dokunulabilecek dosyalar

- `client/src/App.jsx` — bayrak dalı; eski yol aynen kalır
- `client/src/shell/` (yeni) — `AppShell.jsx`, `Rail.jsx`, `TopBar.jsx`,
  `WorkTabs.jsx`, `routes.js`, `shell.css`
- `client/src/modules/` (yeni) — `Home.jsx`, `Sources.jsx`, `Audit.jsx`
- `client/src/audit/audit.js` (yeni) + `client/tests/audit.test.js` (yeni)
- `client/tests/shell.test.js` (yeni) — envanter ve geçiş testleri
- `client/src/components/workspace/Workspace.jsx` — `embedded` modu, köprü
- `client/src/styles/workspace.css` — gömülü yerleşim
- `client/src/components/HistorySidebar.jsx` — içerik bileşenleri dışa
  açılabilir; davranışı değişmez
- `client/src/i18n/tr.js`, `en.js`
- `CLAUDE.md` 3.12 — yeni bayrak satırı
- `docs/work-orders/README.md`

Sunucuya dokunulmuyor. Yeni bağımlılık yok (Öneri 5 hariç, o ayrı onay).

## Geri alma

`APP_SHELL_ENABLED = false` → bugünkü arayüz. Kod geri almak gerekirse dal
`wo-010-kabuk` tek hamlede `git revert` edilir.

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Yazım'ı portaldan çıkarmak `contentEditable` imleç/seçim davranışını bozar | Orta | Yüksek | `embedded` yalnız konumlandırmayı değiştirir; düzenleyici kodu aynen kalır. Aşama 0.5 sonunda kullanıcı elle dener |
| `App.jsx` 1150 satır, durum her yerde; modüllere bölmek hata üretir | **Yüksek** | Orta | Durum `App.jsx`'te kalır, modüller prop alır. Bu iş emrinde durum yönetimi refaktörü yok |
| Sekmeler arasında gizlenen paneller bellek tüketir | Düşük | Düşük | Bugün de aynı desen (`hidden`) |
| Tasarım ile tüzük çatışması tekrar tekrar çıkar | Orta | Orta | Yukarıdaki çeviri tablosu; yeni çatışma rapora yazılır |
| Tarayıcıda gezinme testi yok; geçişler elle kontrol | **Yüksek** | Orta | Öneri 5 |

## Geliştirme önerileri — başlamadan önce

| # | Öneri | Değeri | Maliyet | Karar |
| --- | --- | --- | --- | --- |
| 1 | **Önce bekleyen işi commit et.** Dalda 30'dan fazla commit edilmemiş dosya var (atıflı cümle, kaynakça, içe aktarma, WO-006, WO-009) | Kabuk ters giderse geri dönüş noktası temiz olur | 5 dk | Kullanıcı |
| 2 | **Hash yönlendirme** (`#/yazim`) | Geri tuşu ve yenileme yerinde kalır; bağlantı paylaşılabilir. Yeni bağımlılık yok | Küçük | Plana alındı (0.2) |
| 3 | **`Ctrl+K` komut paleti** | Modüle git, belgede bölüme git, sepette kaynak ara, "literatürde ara: …" | Orta | Önerilir, 0.x'e eklenebilir |
| 4 | **Odak modu** | Eski "sadece yazı" isteğini karşılar | Küçük | Plana alındı (0.5) |
| 5 | **Playwright ile gezinme testleri** | Geçiş tablosu otomatik test edilir; Döngü C elle yükü azalır | Orta, **yeni geliştirme bağımlılığı** | Kullanıcı onayı |
| 6 | **Çoklu belge** (projede birden çok taslak) | Çalışma sekmeleri ve "projeler" ancak bununla anlam kazanır | Orta; yerel depolama şeması değişir | Ayrı iş emri |
| 7 | **Belgeyi sunucuda saklamak** | "Bulutta" yazabilmek, cihazlar arası açmak, Aşama 6'nın ön koşulu | Büyük (şema göçü) | Ayrı iş emri |
| 8 | **Denetim kuralları saf modül** | WO-006 gibi test edilebilir; arayüzden bağımsız | — | Plana alındı (2.1) |
| 9 | **Kurum şablonları** (İTÜ FBE, YÖK) kural dosyası olarak | "Şablona uygun" demek ancak kurallar yazılıysa dürüst | Orta; kılavuzları okumak gerek | Ayrı iş emri |
| 10 | **Klavye erişimi**: rayda ve sekmelerde ok tuşları, modül değişince odak başlığa | Erişilebilirlik | Küçük | Plana alındı |

## Kabul kriterleri

- [ ] Envanterdeki her öğenin yeni yerinde `data-action` kimliği var; test bunu doğruluyor
- [ ] Bayrak kapalıyken bugünkü arayüz değişmeden çalışıyor (aynı testler)
- [ ] Geçiş tablosundaki her satır kullanıcı tarafından denendi (Döngü C listesi)
- [ ] Yasak kalıp taraması temiz (Döngü B.4)
- [ ] Mevcut 94 istemci testi düşmedi; lint ve build temiz
- [ ] Geri tuşu ve yenileme aynı modülde bırakıyor
- [ ] Yazım gömülüyken düzenleme, atıflı cümle, kaynakça, Word dışa aktarma çalışıyor
- [ ] Denetim'deki her uyarının "Metinde göster"i doğru cümleye götürüyor
- [ ] `main`'e push yok

## Bitiş raporu

**Dal:** `wo-006-istatistik` (kullanıcı kararıyla commit yok; dal adı değişmedi).

**Yeni dosyalar**
- `client/src/shell/` — `AppShell.jsx`, `routes.js`, `useHashRoute.js`, `useLibraryData.js`, `shell.css`
- `client/src/modules/` — `Home.jsx`, `Sources.jsx`, `Audit.jsx`, `audit.css`
- `client/src/audit/audit.js`
- `client/tests/shell.test.js` (9), `client/tests/audit.test.js` (14)
- `client/playwright.config.js`, `client/e2e/` — `fixtures.js`, `shell.spec.js` (17),
  `write.spec.js` (8), `audit.spec.js` (9), `screens.spec.js` (yalnız elle, ekran görüntüsü)

**Değişen dosyalar**
- `client/src/App.jsx` — bayrak, adres, sekmeler, köprü; arama içeriği ve
  Araştırmacı paneli ortak değişkenlere alındı (iki düzen aynı düğümü çiziyor)
- `client/src/components/workspace/Workspace.jsx` — `embedded`, `apiRef`,
  `onSnapshot`, odak modu; Aşama 1 yerleşimi
- `client/src/styles/workspace.css`, `client/src/i18n/tr.js`, `en.js`
- `client/package.json` (+ `@playwright/test` 1.64.1, Apache-2.0, geliştirme
  bağımlılığı; `test:e2e` betiği), `client/package-lock.json`, `client/.gitignore`
- `CLAUDE.md` 3.12 (bayrak satırı), `docs/work-orders/README.md`

**Kararlar ve sapmalar**
1. **Aşama 1 yerleşimi eski düzende de geçerli.** Yazım yüzeyi tek bileşen;
   iç rayın kalkması, sağ panelin üç sekmesi ve ölçek iki düzende de var.
   Bayrak kabuğu açıp kapatıyor, Yazım'ın iç yerleşimini değil. K5 bu kadar
   daraltıldı; ikinci bir Yazım yerleşimi taşımak bakımı ikiye katlardı.
2. **Döngü B'de sunucu tarafı render dumanı yerine Playwright.** Gerçek
   tarayıcıda 34 senaryo, API sahte cevaplı (dış kaynağa, veritabanına,
   modele gitmiyor). Duman testinden güçlü: tıklama, adres, odak, seçim,
   indirme dahil.
3. **Kaydedilmiş analizlerin `%` uygunluk çipleri Alanım'a taşınmadı.**
   Model puanı kalibre olasılık gibi görünüyordu (tüzük 2.8).
4. **Denetim yalnız elimizdeki veriyle.** "Doğrulanmamış iddia" yerine
   "atıf işareti olmayan iddia cümlesi"; kurum şablonu yerine "seçili sayfa
   düzeni"; skor yerine sayılar; PDF/A ve LaTeX listelenmedi. Kontrol
   edilmeyenler sayfada yazıyor.
5. **Sağ panel açılınca yer kuralı** ölçüye dayanıyor: masa genişliği − 360
   < sayfa + 48 ise belge yapısı kapanır. Taslak görünümünde 1440 px'te ikisi
   birden sığıyor ve açık kalıyor; Teslim'de A4 sığmıyor ve kapanıyor.
6. **"Gerçek boyut" ekrandaki %100'dür, fiziksel kağıt boyutu değil**
   (brief §2). Düğmenin ipucunda yazıyor.

**Çalıştırılan testler ve gerçek çıktıları**

| Komut | Çıktı |
| --- | --- |
| `cd client && npm test` | `tests 117 · pass 117 · fail 0` (94 → 117) |
| `cd client && npm run test:e2e` | `34 passed · 1 skipped` — üç ayrı koşumda aynı |
| `cd client && npm run lint` | Temiz |
| `cd client && npm run check-i18n` | Yalnız eskiden beri duran `criteria.` |
| `cd client && npm run build` | Başarılı, `index-*.js` 553,84 kB (önce 520,97); Denetim ayrı parça 10,6 kB |

Sunucuya dokunulmadı; sunucu testleri koşturulmadı.

**Yolda bulunan ve düzeltilen**
- Alanım'da yazar araması "Ayşe Yılmaz · İsimsiz arama" diye görünüyordu.
- Yazım'da 1440 px'te araç çubuğu iki satıra kayıyordu; yazı tipi seçicileri
  1600 px altında "Sayfa ayarları"na bırakıldı.
- Geliştirme uyarı şeridi kabukta sayfayı örtüyordu; kabukta sağ altta yüzen
  notta duruyor. Durum çubuğunun sağ ucunu hâlâ örtebiliyor (yalnız
  geliştirmede, kapatılabilir).
- **İş kazası:** `App.jsx` bir düzenleme betiği yüzünden boşaldı (dosya
  yazmak için açıldı, sonra betik hata verdi). Claude Code dosya geçmişindeki
  oturum öncesi yedekten geri yüklendi, oturumdaki düzenlemeler yeniden
  uygulandı; bölme betiğinin aynı satır aralıklarını bulması iki halin
  birebir aynı olduğunu gösterdi. Betikler artık geçici dosyaya yazıp
  `os.replace` ediyor.

**Ölçülmedi:** kullanıcı tarafı süre, erişilebilirlik denetimi (ekran
okuyucuyla deneme yapılmadı), 768 px altı mobil yerleşim (CSS yazıldı, e2e
yalnız 1440 × 900).

**Bilinen eksikler**
- Çalışma sekmeleri modül oturumları; çoklu belge yok (Öneri 6).
- Yorumlar, sürüm geçmişi, değişiklik izleme, belge paylaşımı yok (Aşama 6).
- Komut paleti yok; `Ctrl+K` aramaya götürüyor (Öneri 3).
- Seçim araç çubuğunda "Atıf doğrula" yok (WO-005).
- Yazım'daki görünüm ve ölçek durum çubuğuna taşındı; eski üst çubuktaki
  yerini arayan kullanıcı ilk seferde bulamayabilir.

**Sonraki adım:** Döngü C — kullanıcı yerelde gezer (liste yanıtta). Onaydan
sonra commit planı: belgeler / kabuk / Yazım / Denetim.

- **Durum:** NEEDS ATTENTION — otomatik kontrollerin hepsi geçti; iş emrinin
  kendi kuralı gereği arayüz kullanıcı elle denemeden bitmiş sayılmaz.
