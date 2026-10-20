# Sadeleştirme turu: kontrol kılavuzu

Bu tur bir tasarım işi değil, sadeleştirme işi. Amaç kaldırmak, birleştirmek,
yeniden adlandırmak ya da taşımak. Yeni özellik eklemek bu turun konusu değil.
Turda çıkan liste tek bir iş emrine dönüşür.

## Dayandığı standart yöntemler

Turda kendi icadımız yok, iki yerleşik yöntem birlikte kullanılıyor. İstenirse
sonuna bir anket de eklenebiliyor.

| Yöntem | Ne yapar | Bizde nasıl |
| --- | --- | --- |
| **Bilişsel yürüyüş** (cognitive walkthrough; Wharton vd., Nielsen ve Mack 1993; Spencer'ın 2 soruluk kısa sürümü) | Gerçek bir görevi adım adım yapar. Her adımda iki soru sorulur: "Ne yapacağımı biliyor muyum?" ve "Doğru şeyi yapınca ilerlediğimi anlıyor muyum?" | Aşağıdaki 8 görev |
| **Sezgisel değerlendirme** (heuristic evaluation; Nielsen'in 10 ilkesi) | Ekranı on ilkeye göre tarar. Her sorun 0–4 arası önem derecesi alır. | Her ekranda kısa kontrol listesi |
| **SUS** (System Usability Scale), isteğe bağlı | 10 soruluk anket, 0–100 puan verir. Ortalama 68'dir. Bu bir yüzde değil. | Başka birinin kullandığı turun sonunda |

Bilinen sınır: tek bir değerlendirici sorunların yaklaşık üçte birini bulur. Beş
kişi bulunanların çoğunu kapsar. Bu yüzden ilk turu sen yap, sonra mümkünse
2–3 kişiye (Semih, ürünü hiç görmemiş iki akademisyen) aynı görevleri yaptır.

Kaynaklar: [DePaul — bilişsel yürüyüş soruları](https://facsrv.cs.depaul.edu/~cmiller/ixd/materials/cw.html),
[Wikipedia — Cognitive walkthrough](https://en.wikipedia.org/wiki/Cognitive_walkthrough),
[UW — sezgisel değerlendirme ödevi](https://courses.cs.washington.edu/courses/cse510/14sp/labs/heuristic-evaluation.pdf),
[MeasuringU — SUS hakkında 10 şey](https://www.measuringu.com/10-things-sus).
Hazır şablon olarak Miro'da "Universal Heuristic Evaluation" var. GitHub'da
ise sağlam, bakımı süren bir şablon reposu bulunamadı; çıkan sonuçlar ders
ödevi ya da yapay zekâ "skill" dosyalarıydı. Bu kılavuz kendi şablonumuzdur.

## Başlamadan

1. Uygulama adresi http://localhost:5173. Sunucu (3000) ve istemci (5173) açık.
2. Yeni açılış sayfası http://localhost:5173/?landing&giris=yeni adresinde.
   Eski sayfa şimdilik varsayılan kalıyor.
3. Tarayıcıyı tam ekranda ve bir kez de dar pencerede (telefon genişliği)
   dene: F12 → cihaz simgesi → 390 px.
4. Not tablosunu aç (aşağıda). **Bir şeyi düzeltmeye çalışma, yalnız yaz.**
5. Sesli düşün. Takıldığın yer en değerli not.

## Görevler (bilişsel yürüyüş)

Her görevde iki soruyu sor:
- **S1:** Sıradaki adımda ne yapacağımı ekranda görüyor muyum?
- **S2:** Yaptıktan sonra işe yaradığını anlıyor muyum?

İkisinden biri "hayır"sa not al.

| # | Görev | Bitti sayılması için |
| --- | --- | --- |
| G1 | Bir konu ara, sonuçlardan 3 makaleyi sepete ekle | Sepet sayısı 3 |
| G2 | Sonuçlarda "AI ile geliştir"i ve analizi aç, oku | Ne söylediğini bir cümleyle anlatabiliyorsun |
| G3 | "Araştırmacı ara"dan bir kişiyi bul, doğru kişi olduğuna karar ver | Kişinin yayınları açık |
| G4 | Yeni taslak aç, bir paragraf yaz. Sepetteki bir kaynaktan cümle üret, metne ekle, bir atıf ekle | Atıf belgede, kaynakça oluştu |
| G5 | Belgeye 3×3 tablo, bir şekil ve bir grafik ekle | Üçü de numaralı başlığıyla belgede |
| G6 | "Teslime hazırla"yı aç, bir uyarıyı düzelt, Word'e aktar ve Word'de aç | Word'de tablo ve şekil başlıkları doğru |
| G7 | ⋯ menüsünden yapay zekâ bağlantılarını bul (anahtar eklemeden bak) | Ne işe yaradığını anlıyorsun |
| G8 | Veri kaynakları penceresini bul | Pencere açık |

Her görev için süreyi kabaca yaz. Bir dakikadan uzun süren görev aday sorundur.

## Ekran ekran kontrol (sezgisel değerlendirme)

Her ekranda önce planladığımız üç soruya bak:
1. **İlk ne yapılır?** Ekrana ilk bakışta göz nereye gidiyor? Gitmesi gereken yere mi?
2. **Gereksiz ne var?** Hiç tıklamayacağın ya da ne olduğunu bilmediğin her şey.
3. **Hangi kelime anlaşılmıyor?** Teknik terim, İngilizce kalıntı, iki anlama gelen ad.

Sonra şu kısa listeye göz at. Bunlar Nielsen'in ilkelerinin bizim ürüne
uyarlanmış hali:
- **Durum görünür mü?** Arama sürüyor mu, kaydedildi mi, hangi kaynak düştü?
- **Kullanıcının dili mi?** "Pasaj", "konsensüs", "APA 7" gibi kelimeler hedef kitleye açık mı?
- **Geri dönüş var mı?** Silmeyi geri alma, Esc ile kapatma, Ctrl+Z.
- **Tutarlı mı?** Aynı iş iki yerde iki farklı adla mı geçiyor?
- **Hata önlenmiş mi?** Yanlışlıkla silme ya da sessizce kaybolan iş var mı?
- **Hatırlamak yerine görmek:** Nerede olduğunu ve neyin seçili olduğunu ekran söylüyor mu?
- **Sade mi?** Aynı anda gereğinden fazla düğme var mı?
- **Hata mesajı anlaşılır mı?** Ne olduğunu ve ne yapılacağını söylüyor mu?
- **Yardım yerinde mi?** Takıldığında yardım bir tık uzakta mı?

### Ekran listesi

| Ekran | Nereden | Özellikle bak |
| --- | --- | --- |
| A. Açılış sayfası (eski ve `?giris=yeni`) | Çıkış yapmış hâlde | Hangisi daha net anlatıyor? "Ne yapıyor" 5 saniyede anlaşılıyor mu? |
| B. Arama ana sayfası | Giriş sonrası | Örnek konular, "kaldığın yer" kartları gerekli mi? |
| C. Arama bekleme | Arama sırasında | Bekleme animasyonu sinir bozuyor mu? |
| D. Sonuç listesi + kart | Arama sonrası | Kartta fazla bilgi var mı? Puan ve rozetler anlaşılıyor mu? |
| E. AI analizi / AI ile geliştir | Sonuç sayfası | Başlıklar ve "özet üzerinden" notu |
| F. Araştırmacı paneli | "Araştırmacı ara" | Kurum eşleşmesi notu, gizlenenler satırı |
| G. Kenar çubuğu (açık ve kapalı) | Logo | Çalışmalarım, Favoriler, Makalen için, ⋯ menüsü; simge boyutları |
| H. Yazım ekranı üst çubuğu | Yaz | Başlık satırı, "APA 7 · A4", Teslime hazırla, Dışa aktar |
| I. Biçim çubuğu | Yaz | Simgeler tanınıyor mu? Tablo, Şekil, Grafik ve Sayfa ayarları yalnız simge |
| J. Sağ panel (kaynaklar, cümle üretimi) | Yaz | Kart metinleri, destek şekilleri (● ◐ ○ ▲) anlaşılıyor mu? |
| K. Tablo, şekil ve grafik taslak alanı | Biçim çubuğu | "Tamam" ve vazgeç akışı |
| L. Teslime hazırla | Üst çubuk | Uyarıların dili, "iddia değil" eylemi |
| M. Dışa aktar ve Word çıktısı | Üst çubuk | Dosya adı, Word'deki görünüm |
| N. Yapay zekâ bağlantıları | ⋯ menüsü | Anahtar kavramı akademisyene açık mı? |
| O. Yardım, Veri kaynakları, tanışma soruları | ⋯ menüsü / ilk giriş | Gerekli mi, uzun mu? |
| P. Telefon genişliği (390 px) | F12 | Yatay kaydırma, üst üste binme |

## Not tablosu

Her sorun için bir satır yaz. Kısa olsun, ekran görüntüsü varsa adını ekle.

| # | Ekran | Ne gördüm (bir cümle) | Öneri: kaldır / birleştir / yeniden adlandır / taşı | Önem 0–4 |
| --- | --- | --- | --- | --- |
| 1 | H | "Teslime hazırla" ne yapıyor anlamadım | Yeniden adlandır: "Kontrol et" | 3 |

Önem derecesi (Nielsen'in ölçeğinden):

| Derece | Anlamı |
| --- | --- |
| 0 | Sorun değil |
| 1 | Görünüş; vakit olursa |
| 2 | Küçük; düşük öncelik |
| 3 | Büyük; önce bu |
| 4 | Felaket; yayından önce mutlaka |

## Bittiğinde

1. Tabloyu bana yapıştır, ekran görüntüsü varsa onu da gönder.
2. Ben aynı sorunları birleştirir, 3–4 dereceliler önce gelecek şekilde
   sıralar ve tek iş emri (WO-030) taslağı yazarım. Yeni özellik isteği
   çıkarsa onu ayrı listeye koyarım.
3. Başkası da denerse aynı görevleri verip aynı tabloyu doldurt. İstersen
   sonunda SUS anketini de uygulat; tek kişinin puanı bir şey söylemez, birkaç
   kişinin ortalamasına bakılır.
