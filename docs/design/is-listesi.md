# İş listesi: yapılacaklar, bekleyenler, uzun vadeli planlar

**Tarih:** 20.10.2026. Canlıda: main `7e19478`.
**Kaynaklar:** `docs/work-orders/README.md`, `yol-haritasi.md`,
`urunlestirme-plani.md`, `eksikler-akademisyen-ogrenci.md`,
`ticari-sistem-istekleri.md`, `tema-ve-tablo-tasarimi.md`,
`sadelestirme-turu-notlar.md`, oturum hafızası.

Bu belge bir özettir. Ayrıntı her satırdaki belgededir.

---

## A. Hemen başlanabilecek işler (karar alınmış)

| # | İş | Neden şimdi | İlk adım |
| --- | --- | --- | --- |
| A1 | **WO-031 Tablo tasarımı:** Word gibi stil galerisi + Başlık / Toplam / Bantlı satır / İlk sütun; Word'e hücre gölgesiyle bozulmadan | Ahmet bütün tablo temalarını onayladı (`mockup-paletler.html`) | İş emri taslağı → onay → kod |
| A2 | **İş emirleri listesini güncellemek:** README'de eskimiş durumlar var (WO-017, 019, 023, 025, 026 fiilen bitti ya da yerini başka iş aldı) | Yanlış durum yanlış iş seçtirir | Belge düzeltmesi, kod yok |
| A3 | **CLAUDE.md 3.12 bayrak tablosu:** `TABLES_ENABLED` ve `FIGURES_ENABLED` "yalnız dalda" yazıyor ama artık canlıda; `VISUALS_ENABLED` notu | Tüzük kendisi istiyor: "Yeni bayrak ekleyen iş bu tabloyu günceller" | Belge düzeltmesi (CLAUDE.md'ye dokunmak için onay) |
| A4 | **Sadeleştirme turuna devam:** Ahmet ekranları gezer, bulgular WO-032'ye | Tur yarıda kaldı (bulgu 3 hâlâ açık) | Ahmet'in gezintisi |

## B. Senin kararını ya da elle denemeni bekleyenler

### B1. Acil
- **Sızan Google anahtarı:** `server/scratch/test_embed_model.js` main geçmişinde duruyor
  (`31eefae`). Google Cloud panelinden iptal edilmeli. Geçmişten silmek ayrı ve geri dönüşü
  zor bir iş (geçmiş yeniden yazılır, onay gerekir).

### B2. Elle deneme (canlıda, sen henüz bakmadın)
- Açılış sayfası v9 (artık varsayılan).
- Word gibi tablo (WO-025), şekil/grafik taslak alanı (WO-028), palet seçici (21 palet).
- Sadeleştirme turu 1 (WO-030): Düzenle/Sil simgeleri, sabit biçim çubuğu, arama kapsülü.
- Veri kaynakları penceresi (WO-029): atıf ibarelerinin son okuması.
- Yapay zekâ bağlantıları (WO-027): kendi gerçek anahtarınla bir deneme. Kodda kayıtlı
  model adlarının gerçek sağlayıcıda karşılığı doğrulanmadı.
- Render'da `OPENALEX_API_KEY` tanımlı mı? OpenAlex anahtarsız günde ~100 aramaya izin veriyor.

### B3. Kararlar
| Konu | Seçenekler / not | Belge |
| --- | --- | --- |
| CORE canlı aramadan çıksın mı | Lisans "para kazanan ürün için lisans" istiyor; tüzükte Kademe 2 | `sources.md` |
| arXiv kademe çelişkisi | Tüzük "yalnız hasat" diyor, kod canlı sorguluyor; tüzük ya da kod değişir | `sources.md` |
| Semantic Scholar anahtarı | Anahtarsız ortak havuz 429 veriyor | `sources.md` |
| İzin yazıları | ULAKBİM (DergiPark, TR Dizin), CORE, AI2, Crossref (Retraction Watch) | `sources.md` |
| WO-005 kanıt doğrulama | Taslağı onay, doğrulama modeli, Mongo Claim/Evidence ayrı iş | `WO-005-kanit-dogrulama.md` |
| Atıflı metinde atıf | (a) bizim kayıttan / (b) model yazar, kullanıcı teyit eder (tüzük değişir) | `ticari-sistem-istekleri.md` |
| Sohbet paneli ve tüzük 2.2 | "Sohbet arayüzü değiliz" maddesi nasıl değişecek | aynı |
| Şekil galerisi | 24 şablon: Kalsın / Düzelt / At | `mockup-sekil-galerisi.html` |
| Şekil temaları | Paul Tol lisansı sorulsun mu; belge teması olsun mu | `tema-ve-tablo-tasarimi.md` |
| Eski açılış sayfası | Silinsin mi (`?giris=eski`) | — |
| WO-015 istatistik v2 | 5 mi 3 mü test; Bonferroni; Welch ANOVA | `WO-015` |
| WO-020 köprü | `Basket.query` alanı (şema) onayı | `WO-020` |

## C. Orta vade (birkaç hafta): ürünü "tez için güvenilir" yapan işler

Sıra önerisi gerekçesiyle:

1. **Taslakların sunucuda saklanması:** En büyük risk. Bugün tez taslağı yalnız
   tarayıcıda duruyor; "geçmişi temizle" aylarca emeği siler. Şema ve depolama kararı ister
   (kural 6). Danışman paylaşımının (madde 5) ön koşulu.
2. **WO-005 kanıt doğrulama:** Ürünün tek cümlelik tanımı bu. Taslak hazır.
3. **Değerlendirme kümeleri (Bölüm 4):** E2 (50 iddia–pasaj), E4 (atıf doğruluğu), E1
   (kaynak bulma). "Doğru sonuç" iddiası bunlarsız yapılamaz. E2'yi Ahmet etiketler
   (bir öğleden sonra).
4. **WO-032 şekil temaları:** Şablon şeridi (içerik korunarak şablon değiştirme, SmartArt
   gibi) + belge teması + galeriden yeni şablonlar.
5. **Danışmana salt okunur paylaşım ve yorum:** Seçim menüsünde "Yorum" zaten "Yakında" diye duruyor.
6. **ISNAD atıf biçimi:** Türk sosyal bilimler, ilahiyat ve tarih dergileri istiyor; rakiplerde yok.
7. **Tanışma cevaplarına göre varsayılanlar:** Lisans, tez ya da makale şablonu.
8. **Kendi PDF'ini kanıt kaynağı yapma:** Tam metinden pasaj almanın lisans sorunu
   yaratmayan yolu. Dosya saklama ve KVKK için iş emri gerekir.
9. **Konu takibi:** Kayıtlı aramaya haftalık "yeni çıkanlar" e-postası (Resend altyapısı var).
10. **Zotero iki yönlü bağlantı:** Öncelik düşük.
11. **İstatistik v2 (WO-015)** ve **Analiz sekmesi (WO-007).**
12. **Etkileşim altyapısı ve durumlar (WO-018, WO-021):** Bir kısmı WO-024 ve WO-030'da
    yapıldı; kalanlar yeniden kapsamlanmalı.

## D. Uzun vade: ticari sistem (`ticari-sistem-istekleri.md`)

Her madde için: ne gerekiyor → bağımlılık → risk → ilk somut adım.

### D1. Kendi makale veritabanımız
- **Ne:** Açık kaynak meta veri + özet (+ ileride açık erişim tam metin), alan gruplaması, atıf ağı.
- **Boyut (ölçüldü / tahmin):**
  - Özetler + künye ~75–90 GB.
  - Tam metinsiz bütün katmanlar 250–400 GB.
  - Tam metinle ~1,3–1,5 TB.
- **Bağımlılık:** Sunucu ve depolama kararı; OpenAlex toplu indirmenin ücretli olup olmadığı.
- **Risk:**
  - Özetlerin telifi kaynağa göre değişir.
  - Vektör hesaplamak saklamaktan pahalı.
  - Tazeleme işi (günlük değişiklik dosyaları).
- **İlk adım (aşama 0, bedava):**
  - OpenAlex `group_by` ile konu × yıl sayım tabloları, bugünkü sunucuda.
  - "En çok / en az yazılan" önerisi 2.8 diliyle.
- **Aşama 1:**
  - Tek alan (ör. mühendislik, 2015 sonrası) küçük sunucuda.
  - Kayıt başına gerçek boyut ve sorgu hızı ölçülür.

### D2. Konu ve boşluk önerisi
- **Ne:** "Bu konuda şu alt konu az çalışılmış, şu komşu konu dolu" ve sektör bazlı öneri.
- **Bağımlılık:** D1 aşama 0 yeter; alan gruplaması (OpenAlex konu ağacı).
- **Risk:** "Çalışma yok" demek (2.8); öneri kalitesini ölçmek için E1 benzeri küme.
- **İlk adım:** Bir alanda 20 sorguluk küçük bir altın küme + sayım tabanlı ilk sürüm.

### D3. Yapay zekâ paneli (sohbet)
- **Ne:**
  - Kullanıcının kendi anahtarıyla çalışır.
  - Şimdilik anahtarsız kullanıcıya bizim anahtar, kullanıcı başı sınırla.
  - "Literatür AI'a hoş geldiniz" kişilikli araştırma botu.
  - Her soruda veritabanından ilgili özetler eklenir (RAG).
- **Bağımlılık:** WO-027 geçidi var; D1 aşama 0/1; tüzük 2.2 değişikliği; KVKK açık rızası.
- **Risk:** Maliyet (anahtarsız açık kaldıkça), uydurma bilgi, prompt sızması (sır yoksa sorun değil).
- **İlk adım:**
  - Tüzük 2.2 metnini birlikte yazmak.
  - Panel iskeleti, maliyet kaydı (3.9), bayrak.

### D4. Atıflı metin + yeniden yaz
- **Ne:**
  - Sağ panelde metin üretilir, okunup "Tamam" ile belgeye girer.
  - Bölüm bölüm ya da tamamı yeniden yazılabilir.
- **Bağımlılık:** WO-005 (doğrulama), atıf kararı (a/b), E2/E4 kümeleri.
- **Risk:** Uydurma atıf; tüzük 2.1/2.2/3.1.
- **İlk adım:** PR2'yi çok cümleye genişleten taslak prompt + her cümleye pasaj bağı.

### D5. Kurum hocaları ve iş birliği önerisi
- **Ne:**
  - Kurumsal e-postadan kurum bulunur.
  - Hocanın konuları çıkarılır.
  - "Şu alanda kurumunuzdan X çok çalışmış" önerisi verilir.
  - 6 ayda bir yeni yayın taraması.
- **Bağımlılık:** Araştırmacı paneli (var), OpenAlex kurum ve yazar verisi, ROR alan adları.
- **Risk:** Profil eşleşmesi hatası (kullanıcı onaylar); KVKK (kullanım anında izin, "beni gösterme" talebi).
- **İlk adım:** E-posta alan adı → ROR → OpenAlex kurum eşleşmesini tek üniversitede denemek.

### D6. Kendi sınıflandırmamız ve gerekirse model eğitimi
- Önce OpenAlex konu ağacı kullanılır. Kendi sınıflandırmamız ölçüm verisi (D2 kümesi) olunca.
- Model eğitimi tüzükte yasak (3.7); gerekirse tüzük değişikliğiyle ve ancak ölçümle.

### D7. Kütüphane entegrasyonları
- Okulların abonelikli veritabanları. Kurum lisansı ve yazılı izin (Kademe 3 mantığı).
- İlk adım: bir üniversite kütüphanesiyle konuşmak. Teknik iş ondan sonra.

### D8. Poster / Dönüştür
- Ertelendi. Yol A (şablon kutularına bölüm eşleme, PDF) hazır; Yol B karar 1'e bağlı.

### D9. Ödeme planları
- Ertelendi. Gelir başladığı gün ORCID kapanır (`sources.md` kontrol listesi). Kaynakların
  ticari koşulları yeniden okunur. Türkiye'de çalışan ödeme sağlayıcısı seçilir.

### D10. Türkçe korpus
- DergiPark OAI-PMH ve TR Dizin teknik olarak hazır (denendi), ULAKBİM yazılı izni bekliyor.
- YÖK Tez'in resmi API'si yok, kazıma yapılmaz.

### D11. Mimari hedefler (tüzük Bölüm 3, bugün kodda yok)
- `Claim` / `Evidence` veri modeli.
- Doğrulama kararı önbelleği (3.4).
- Tek kova + kalıcı kuyruk (3.5).
- Retraction Watch yerel dökümü (3.5).
- Ölçüm kaydı (3.9).
- Enjeksiyon test kümesi (3.8).

## E. Teknik borç

- Yerel `npm run build` antivirüs yüzünden yalnız `--minify false` ile çalışıyor (Vercel etkilenmiyor).
- Uzun e2e koşusu bilgisayar uykuya geçince yanlış hata verebiliyor.
- Kullanıcı anahtarı: depo hatası olur ve önbellekte kayıt yoksa çağrı platform anahtarına düşüyor.
- Yazım ve gömme (embedding) çağrıları yalnız DeepSeek, Gemini ve Groq ile çalışıyor.
- WO-008 (şekil gömme) büyük ölçüde WO-028 ile yapıldı; kalan kapsam yeniden yazılmalı.
- `client/src/i18n/tr.js` içinde "Yazar modu" kalıntıları (tüzük 2.13).

## F. Ahmet'in göndereceği repolar

Konudan bağımsız repolar en son, ayrı incelenecek. Daha önce not edilen:
`github.com/morluto/rea` (tersine mühendislik; lisans ve ne yaptığı incelenmedi).

### İncelendi (20.10.2026; GitHub API + README)

| Repo | Lisans / yıldız | Ne | Bize | Karar önerisi |
| --- | --- | --- | --- | --- |
| [OmniRoute](https://github.com/diegosouzapw/OmniRoute) | MIT / ~79 bin, TS | Tek uçtan 375 sağlayıcı, 1.400+ model; kota bilen yedek, model keşfi, sıkıştırma | WO-027 geçidimizin büyük hali. Alınacak fikirler: kota dolunca yedek model, model kataloğu keşfi, maliyet telemetrisi (3.9) | Bağımlılık değil, fikir. Ücretsiz kotaları üst üste koymak sağlayıcı şartlarına aykırı olabilir. Bütün anahtarları tutan ayrı servis = bakım ve güvenlik yükü |
| [Headroom](https://github.com/headroomlabs-ai/headroom) | Apache 2.0 / ~77 bin, Python (+TS SDK) | Modele gitmeden önce arama parçalarını, kayıtları, dosyaları sıkıştırır; yerelde; orijinali saklar | D3 sohbet panelinde, kullanıcı anahtarındaki maliyeti düşürmek için | D3'te Türkçe özetlerle ölçülür. **Kanıt doğrulama ve alıntıda kullanılmaz** (3.2 birebir pasaj). Python çekirdek, Node sunucumuzla uyum ayrıca bakılır |
| [claude-mem](https://github.com/thedotmack/claude-mem) | Apache 2.0 / ~102 bin, TS | Kodlama asistanı oturumları için kalıcı hafıza | Ürüne değil, geliştirme düzenine; bizde hafıza ve devir notları zaten var | Gerek yok. Varsayılan kurulum oturum içeriğini kendi bulutuna gönderir; denenirse yalnız yerel mod |
| Claude Code "Advanced setup" belgesi | — | Kurulum, güncelleme, kaldırma | Ürünle ilgisiz. Windows'ta sandbox yalnız WSL 2'de; mevcut kurulum (Git Bash + PowerShell) uygun | — |

---

## Önerilen sıra (ilk beş)

1. Google anahtarını iptal et (senden, 5 dakika).
2. A1 tablo tasarımı + A2/A3 belge düzeltmeleri.
3. C1 taslakların sunucuda saklanması (onay gerekir).
4. D1 aşama 0 (sayım tablolarıyla boşluk önerisi): ticari sistemin bedava ilk adımı.
5. C2 WO-005 kanıt doğrulama + C3 E2 kümesi.
