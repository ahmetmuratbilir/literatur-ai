# Ticarileşme için yeni sistem: istekler (kayıt)

**Durum:** yalnız kayıt (Ahmet, 20.10.2026). Uygulama yok; Ahmet "başla"
deyince adım adım iş emrine dönüşür. Aşağıdaki "Dikkat" notları onun
sözü değil, tüzükle karşılaştırmadır; karar onun.

## Adım 1 — Kendi makale veritabanımız

**İstek (Ahmet'in sözleriyle özet):**
- Açık kaynaklardaki **bütün** makalelerin verisini yavaş yavaş kendi veritabanımıza
  alalım: ad, özet, yazar, atıf vb. En az yer kaplayan biçimde.
- Benzersiz kaç makaleye erişebildiğimizi bilelim.
- Bir makaleye kimlerin atıf yaptığını, kaynakçasını tutalım; birbirine bağlanan
  konuları bağlayalım. Atıf yapan makaleye erişemiyorsak yalnız bilgisi (metadata)
  kalsın.

**Neden lazım — öneri sistemi:**
- Kullanıcı bir konu yazınca (ör. "eklemeli imalat") bugün yalnız anahtar kelime
  üretiyoruz. Bunun yerine yönlendirme:
  - "Literatürde şu boşluk var", "en çok şu konudan yazıldı", "şu konudan az yazıldı".
  - Konu önerisi: kullanıcının aradığına yakın, çalışılabilecek açık / ek çalışma önerisi.
  - Her sektör için.
- Örnek konu önerisi literatürden gelmeli.

**Ahmet'in kısıt notu:** "İndirme yok; öneri için meta veri. Erişebildiğimiz tam
metinler zaten açık erişimli. İllegal bir şey yok, doğru mu?"

**Dikkat (doğrulanacak, hukuki görüş değil):**
- Meta veri lisansı kaynağa göre değişir (`docs/sources.md`):
  - OpenAlex CC0, toplu indirme (snapshot) veriyor. En temiz omurga bu.
  - Crossref meta verisi serbest. Ama **özetlerin** bir kısmı yayıncı ya da yazar telifinde.
  - Semantic Scholar veri setlerinin lisansı ticari kullanım için ayrıca okunmalı.
- **Özetleri toplu saklayıp göstermek** ile adı, yazarı ve atıf ağını saklamak aynı risk değil.
- Açık erişim, yeniden dağıtım izni anlamına gelmez (tüzük 3.8). Tam metin saklama makaleye göre lisansa bağlı.
- Bu yüzden öneri: ilk sürümde ad + yazar + yıl + konu kavramları + atıf ağı (CC0), özet yalnız lisansı uygun kaynaklardan.
- Boyut: OpenAlex yaklaşık 250 milyon kayıt (doğrulanmadı). "En küçük biçim" için hangi alanların tutulacağı ve disk ve maliyet hesabı ilk iş olacak.
- **Boşluk ifadeleri 2.8'e uymalı:** "Bu konuda çalışma yok" denmez. "Taranan N kaynakta, şu yıl aralığında, şu konuda X çalışma var; komşu konuya göre az" denir.

**İlke (Ahmet, 20.10.2026):**
- Bu bir gelecek planı. Alabildiğimiz kadar alırız.
- Makale satmıyoruz. Açık erişimli tam metinleri iki iş için kullanırız: metin oluştururken
  kanıt olarak ve doğru konu önerisi için.
- **En önemlisi doğru sonuç.**
- Uygulama notu: "Doğru" iddiası tüzük Bölüm 4'e göre ölçülür. Konu ve boşluk önerisi
  için E1 benzeri bir altın küme, metin için E2 ve E4 kurulmadan kalite iddiası yapılmaz.

### Veri nasıl kullanılır ve nerede durur (öneri, 20.10.2026)

- **Model eğitilmez.** Tüzük 3.7 eğitimi yasaklıyor. Ayrıca ezberletilen bilgi atıf vermez, doğrulanamaz.
- Yol arama + prompt (RAG):
  1. Özetler bir arama motorunda durur.
  2. Soru gelince ilgili 10–20 özet bulunur, modele yalnız bunlar verilir.
  3. Atıf doğrulanmış kayıttan eklenir (3.1).
- Kademeler (fiyatlar akıldan, doğrulanmadı):
  - **Aşama 0:** Konu × yıl sayım tabloları (birkaç MB) bugünkü sunucuda. "En çok / en az yazılan" önerisi hemen ve bedava.
  - **Aşama 1:** Hedef alanlar ya da 2015 sonrası özetler (10–20 GB). Postgres (kelime araması + pgvector) ya da Meilisearch, küçük bulut sunucuda (ayda ~15–30 €).
  - **Aşama 2:** 90 GB'ın tamamı, daha büyük sunucuda (ayda ~40–60 €).
  - **Yedek:** Ham Parquet ucuz depolamada (90 GB için ayda ~1–2 $).
- Bağlantı: Render'daki sunucu arama sunucusuna HTTPS ve anahtarla bağlanır, kullanıcı doğrudan görmez.
- Bakım: haftalık yedek, işletim sistemi güncellemesi, güvenlik duvarı, günlük veri tazeleme.
- Vektör maliyeti: 180 M özete anlam vektörü hesaplamak saklamaktan pahalı. Önce kelime araması (BM25), vektörler yalnız hedef alanlarda.

### Ahmet'in yönü (20.10.2026) ve açık karar

**Ahmet:**
- Bize yalnız depolama ve erişim lazım. DeepSeek bu bilgilerin hepsini bilmeli.
- Konu önerisinde kaynakça sunmaya gerek yok.
- Metin üretirken kullanıcı kendisi teyit eder, "şöyle yaz" deyip değiştirir.

**Not:**
- Model 90 GB'ı "bilemez", çünkü eğitim yok. Bir istekte en fazla yaklaşık 128 bin token okur (≈100 özet).
  Her soruda yine biz arar, ilgili özetleri veririz. Konu önerisinde kaynakça gösterilmeyebilir;
  sayılar ("X çalışma var") modelden değil bizim tablolarımızdan gelir (2.8).
- Metinde atıfı modele bırakmak tüzük 3.1 ve 2.1 ile çelişir (uydurma atıf riski kullanıcıya geçer).

**Açık karar (Ahmet):**
- (a) Metin serbest, atıf bizim kaydımızdan (tüzük aynen kalır).
- (b) Atıfı model yazar, kullanıcı teyit eder (tüzük 2.1, 2.2 ve 3.1 birlikte güncellenir).

### Ek (Ahmet, 20.10.2026): alanlara göre gruplama — ileri aşama

- Kaydederken makaleler alan ve konu başlıklarına gruplanır. Biri "dijital ikiz" dediğinde
  (mühendislik bağlamında) sağlık başlığı altındakilere girilmez. İş basitleşir, doğruluk artar.
- Model eğitimi gerekirse ileride düşünülür. Bunlar ileri aşama geliştirme önerileri.
- Not: OpenAlex her esere zaten dört katmanlı bir konu ağacı veriyor (domain → field →
  subfield → topic; konu sayısı birkaç bin, doğrulanmadı). Kayıtta bu etiketler tutulursa
  gruplama hazır gelir. Arama önce alana göre daraltılır. Birden çok alanda geçen
  terimlerde kullanıcıya alan sorulur.

### Ek (Ahmet, 20.10.2026): kendi sınıflandırmamız, kurum hocaları, iş birliği önerisi — ileri aşama

**İstek:**
- OpenAlex'inkine benzer kendi konu sınıflandırmamız (kodda, ileride).
- Kurumların hocaları ve yayınları kaydedilir. 6 ayda bir ya da gerektiğinde yeni yayın kontrol edilir.
- Kullanıcı kurumsal e-postayla girince üniversitesi anlaşılır. Çalışmaları ve konuları bilindiği için öneri verilir:
  "Bu yönde çok çalışmışsınız, şu kısımlar eksik olabilir. Kurumunuzdaki şu hoca bu alanda
  daha çok çalışmış." Akademik girişli hoca görür, iletişime geçmeyi kendisi seçer.

**Dikkat:**
- **Kaynak OpenAlex olmalı, ORCID değil.** Kurum ve yazar verisi CC0. ORCID genel API'si gelir
  başladığı gün kapanır (tüzük 2.7). Tüzük 3.10'a göre ORCID yalnız zenginleştirir. ORCID toplu
  veri dosyasının lisansı ayrıca doğrulanmalı.
- **E-postadan kurum:** ROR kurum kayıtları alan adı tutuyor. Kişinin OpenAlex profiline
  bağlanması otomatik olmaz; "Bu siz misiniz?" kullanıcı onaylar (3.10: ayrıştırma hatalı olabilir).
- **KVKK:** Yayın bilgisi açık, ama hocalar hakkında "eksik" önerisi üretmek kişisel veri işlemedir.
  Aydınlatma metni ve "beni önerilerde gösterme" seçeneği gerekir. Hukuki görüş değil.
- **İzin akışı (Ahmet, 20.10.2026):**
  - İlk girişte bilgilendirme ve izin: "Kurum içi isim paylaşımı vardır; çalışma başlıklarınız
    ve makaleleriniz incelenir." Kullanıcı izin vererek girer.
  - Konu belli olunca sohbet botu küçük bir bildirimle sorar: "Araştırmanıza yakın çalışan kurum içi isimler aransın mı?"
    Kullanıcı onaylarsa aranır.
  - Maliyet yok, çünkü sohbet kullanıcının kendi anahtarıyla çalışır.
  - Not: Alan analizi de hukuken veri işlemedir; bu akış (bilgilendirme + açık izin + öneri anında onay) onu karşılıyor.
- **Karar (Ahmet, 20.10.2026): karşılıklı izin yok.** İzin, özelliği kullanan kişiden kullanım
  sırasında alınır. Araştırma bireysel başlar; kullanıcı biriyle çalışmak ya da makale hakkında
  soru sormak isteyebilir.
  - Önlem: Önerilen hoca için yalnız herkese açık yayın bilgisi gösterilir (ad, kurum, ilgili yayın başlıkları ve sayısı).
  - Önlem: "Beni önerilerde gösterme" talebi (e-posta ya da destek formu) gelirse listeden çıkarılır.
- **Dil (2.8):** "Eksiksiniz" denmez. "Yayınlarınızda X daha az yer alıyor; kurumunuzdan Y bu
  konuda N yayın yapmış" denir, sayılar bizim veriden gelir.

## Adım 2 — Yapay zekâ paneli

**İstek:** Konuyu belirleme ve benzeri sorular için bir yapay zekâ (sohbet) paneli. İstek maliyeti
yükselebilir; bunun için bir ayar (sınır, kota) yapılacak. Her durumda bir panel gerekli.

**Dikkat:** Tüzük 2.2 "Bir sohbet arayüzü değiliz. Çıktımız cevap değil, kanıt."
diyor. Panel yapılacaksa tüzükte bu maddenin nasıl değişeceği (ör. "sohbet var ama
her cevap kaynağa bağlı") Ahmet'in kararı.

## Adım 3 — Atıflı cümle → atıflı metin

**İstek:** Atıflı cümle kısmı değişecek. Kaydedilen verileri de kullanarak düzgün metin
üretsin. Mevcut prompt (PR2) var, gerekirse geliştirilir. Yazar modundaki sağ panelde metin oluşur,
kullanıcı okur, "Tamam" deyince belgeye düşer.

**Dikkat:** Tüzük 2.2: "Ürün yazarın yerine yazmaz". Üretim yalnız getirilmiş
pasajdan yapılır, her cümle pasajıyla gösterilir, "serbest paragraf üretimi"
kapsam dışı. "Okuyup Tamam deyince belgeye" kısmı 2.9 ile uyumlu. Birden çok
cümlelik metin istenirse her cümlenin kaynak pasajı ve destek sınıfı yine
gösterilmeli; bu sınırın nereye çekileceği Ahmet'in kararı.

### Ek (Ahmet, 20.10.2026): geri alma ve yeniden yazdırma

- Üretilen metinde bir "geri al / yeniden yaz" seçeneği olacak. Kullanıcı isterse bir
  bölümü, isterse metnin tamamını değiştirebilecek.
- Ahmet'in notu: "Bunları onlara bizim yazdırmamız lazım aslında." Kullanıcının istediği
  metni üretmek ürünün işi.

## Adım 2 ve 3 için maliyet çözümü: anahtar zorunlu yapay zekâ paneli

**İstek:**
- Yapay zekâ (sohbet) paneli **yalnız kullanıcının kendi anahtarıyla** çalışır
  (anahtar zorunlu). Kullanıcı kendi anahtarıyla sorar, **bize maliyet çıkmaz**.
- Adminler (Ahmet) kendi modelini, yani platform anahtarını kullanır. Sorun yok.
- Böylece iki temel istek (konu belirleme paneli ve atıflı metin) maliyetsiz çözülür.
- Kullanıcı anahtarını ekleyince onun modeline **gizli bir sistem promptu** gider. Model,
  hangi model olursa olsun, "akademik botumuz" gibi konuşur.
- Verileri olabildiğince küçültüp modele yalnız cevap verecek kadarını veririz;
  model öyle "öğrenir".

**Kodda bugün olan (doğrulandı, WO-023 / WO-027):**
- Kullanıcının kendi anahtarı (`BYOK_ENABLED`) altyapısı var. Her yapay zekâ çağrısı tek kapıdan (`keyFor`) geçiyor.
- Sağlayıcılar: DeepSeek, Gemini, Groq, OpenAI, Kimi, Claude.
- Okunamayan anahtar sessizce platforma düşmüyor.
- "Panel yalnız kendi anahtarıyla, admin platform anahtarıyla" kuralı bu kapıya eklenebilir.

**Dikkat:**
- "Öğrenmesini sağlarız" model eğitmek değildir. Tüzük 3.7: "Sıfırdan büyük dil modeli eğitilmez."
  Bu, her soruda veritabanımızdan ilgili küçük parçayı bulup prompta koymak demek (RAG).
  Maliyet kullanıcının anahtarına yazılır.
- **Gizli prompt tam gizli kalmaz.** Prompt kullanıcının hesabındaki modele gidiyor; model
  istenirse içeriğini söyleyebilir. Promptta sır, anahtar ya da kişisel veri olmamalı.
  Kopyalanması bizi zarara uğratmayacak biçimde yazılmalı.
- Kullanıcının sağlayıcısına giden veri: CC0 meta veri sorun değil. Lisanslı özet ya da
  tam metin gönderilmeden önce lisansına bakılmalı (Adım 1 notu).
- Tüzük 3.1 her durumda geçerli: atıf bilgisi (DOI, yazar, yıl) modelden alınmaz,
  doğrulanmış kayıttan eklenir. Bu, kullanıcının kendi modeli için de geçerli.
- Anahtarsız kullanıcı panelde ne görür (tanıtım, sınırlı deneme, kilit)? Bu bir karar konusu.

### Karar (Ahmet, 20.10.2026): anahtarsız kullanıcı

- **Şimdilik** ürün henüz yayılmadı. Panel, anahtarı olmayan herkese **bizim anahtarımızla açık** kalır.
- **Hedef:** Tanıtım, sınırlı deneme ya da kilitli ekran. Kullanıcı kendi anahtarıyla tam kullanır.
- Yatırım alınırsa komple bizim anahtarımızla açılabilir; ürün satılırsa maliyet ona göre hesaplanır.
- Uygulama notu: Bu bir bayrak olmalı ("anahtarsız kullanıcıya platform anahtarı: açık/kapalı").
  Ayrıca kullanıcı başına bir sınır ve 3.9 maliyet kaydı olmalı; açık kaldığı sürece maliyet görülür.

### Ek (Ahmet, 20.10.2026): prompt ve KVKK

- Gizli prompt bir sır taşımıyor. Model "Literatür AI'a hoş geldiniz" diyen bir araştırma botu
  gibi konuşur. Prompt, iki temel aramanın (konu ve boşluk önerisi, atıflı metin) kalitesini
  artırmak için. Görünmesi sorun değil; yalnız içine anahtar ya da parola konmaz.
- KVKK: Kullanıcının sorusu ve belgesi onun seçtiği sağlayıcıya (çoğu zaman yurt dışına) gider.
  Panel açılmadan önce açık rıza alınır ("izin" olarak).

## Adım 1 için hafıza hesabı (20.10.2026)

OpenAlex API'den bugün alınan sayılar:

| Filtre | Kayıt |
| --- | --- |
| Tümü | 328.192.191 |
| Açık erişimli (`open_access.is_oa:true`) | 128.637.361 |
| Özeti olan (`has_abstract:true`) | 181.721.554 |
| Açık erişimli + özetli | 98.046.473 |
| Açık erişimli makale (`type:article`) | 69.317.259 |
| OpenAlex'in tam metni indekslediği (`has_fulltext:true`) | 56.353.640 |

Tahmini boyutlar. Kayıt başına boyutlar tahmin; ölçülmedi.

| Katman | Yaklaşık |
| --- | --- |
| Meta veri (ad, yıl, yazar kimlikleri, dergi, konu, DOI, açık erişim bağlantısı; ~300 B/kayıt + indeks; 125 M yazar tablosu) | 50–100 GB |
| Atıf ağı (iki yönlü; kenar sayısı doğrulanmadı, birkaç milyar) | 40–80 GB |
| Özetler (182 M × ~1.200 karakter ≈ 220 GB ham; sıkıştırılmış) | 70–90 GB |
| Benzerlik vektörleri (özet başına int8) | 70–140 GB |
| Tam metin, yalnız düz yazı (69 M × ~40 KB; sıkıştırılmış) | ~1 TB |
| PDF saklama | ~70 TB, önerilmez |

**Toplam:** tam metinsiz 250–400 GB; tam metinle 1,3–1,5 TB.

### Yalnız özetler (ölçüldü, 20.10.2026)

OpenAlex'ten rastgele 200 özetli kayıt alındı (`sample`, iki tohum). Sonuç:
- Ortalama özet 1.062 bayt; orta değer 987, en uzun %10'luk dilim 2.086 bayt ve üstü.
- Toplu brotli sıkıştırma ham boyutun %33'ü, gzip %41'i; kayıt kayıt sıkıştırma %39'u.

| | Kayıt | Ham | Sıkıştırılmış |
| --- | --- | --- | --- |
| Bütün özetler | 181,7 M | ~193 GB | ~64–75 GB |
| Yalnız açık erişimli + özetli | 98 M | ~104 GB | ~35–40 GB |
| Yanına kimlik, başlık, yıl, DOI | — | ~27 GB | ~10–12 GB |

**Özetler + temel künye:** tümü ~75–90 GB, yalnız açık erişimli ~45–50 GB.

**Biçim:**
- Sıkıştırılmış düz metin, sütunlu dosyada (Parquet + zstd/brotli).
- JSON alan adlarını tekrarladığı için %10–20 daha büyük.
- WebP resim biçimidir; sayfayı resim olarak saklamak metinden 50–100 kat büyük olur ve içinde arama yapılamaz.
- PDF saklanmaz; metni çıkarılır, kaynağına bağlantı verilir.

**Öneriler:**
- Küçük başla (ör. 2015 sonrası ya da hedef alanlar), kayıt başına boyutu ölç, sonra büyüt.
- Bu boyutta MongoDB Atlas yerine ucuz diskli sunucu + Parquet / DuckDB düşünülmeli (fiyatlar doğrulanmadı).
- OpenAlex toplu indirmesinin (snapshot) ücretli plana bağlı olup olmadığı doğrulanmalı (veri CC0).

## İleride: kütüphane entegrasyonları (Ahmet, 20.10.2026)

Okulların kütüphane verileriyle (abonelikli veritabanları vb.) çalışılabilir. Şimdilik yalnız not;
19.10'daki "okul entegrasyonu" maddesiyle aynı. Abonelikli kaynaklar tüzük 2.7 Kademe 3
mantığıyla, kurumun lisansı ve yazılı izinle değerlendirilir.

## Adım 4 — Sonra

Tablo, şekil ve ne gerekiyorsa (WO-031 tablo tasarımı onaylı, beklemede).

## Başlarken sorulacaklar

1. Veritabanı nerede tutulacak (MongoDB Atlas / ayrı arama motoru / dosya), bütçe?
2. Özet saklansın mı, yoksa ilk sürüm yalnız ad, yazar, kavram ve atıf ağı mı?
3. Sohbet paneli için tüzük 2.2 nasıl değişecek?
4. Atıflı metin: kaç cümleye kadar, her cümle kanıtlı mı?
