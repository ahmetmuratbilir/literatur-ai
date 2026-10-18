# Akademisyen ve öğrenci açısından eksikler — öneri listesi

18.10.2026 · WO-024 kapsamında istenen değerlendirme · **Taslak öneri; hiçbiri
iş emri değildir.** Her madde CLAUDE.md 2.12'nin dört sorusuyla süzüldü.
`yol-haritasi.md` ve `urunlestirme-plani.md` ile çakışma arandı; bunların
hiçbiri orada planlı değil.

Kodda doğrulanan bugünkü durum: atıf biçimleri APA 7, Chicago, IEEE, MLA;
taslaklar yalnız tarayıcıda (localStorage); kaynak içe aktarma var
(`server/services/referenceImport.js`); Zotero bağlantısı yok.

## Öncelik sırasıyla

### 1. Taslakların sunucuda saklanması (en büyük risk)
Bugün tez taslağı yalnız tarayıcıda duruyor; kenar çubuğu bunu dürüstçe
uyarıyor ("tarayıcı verisi silinirse kaybolur"). Bir tez öğrencisi için bu,
aylarca emeğin tek bir "geçmişi temizle" ile gitmesi demek.
- Savunabilir çıktı: belge kaybolmaz, cihazlar arası açılır.
- Ölçüm: sunucuda yedeği olan taslak oranı; kurtarılan taslak sayısı.
- Olmazsa: güven kaybı, kullanıcı ürünü tez için kullanmaz.
- Not: şema ve depolama kararı gerektirir (CLAUDE.md kural 6, onay).

### 2. ISNAD atıf biçimi
Türkiye'de ilahiyat, tarih ve sosyal bilimlerin çoğunda dergiler ve
enstitüler ISNAD istiyor. Türkçe korpus (DergiPark, TR Dizin, YÖK Tez) ile
birlikte, rakiplerin çoğunda olmayan bir ayrışma.
- Ölçüm: ISNAD seçen taslak oranı; tanışma sorularındaki "Türkçe yayın" amacıyla ilişkisi.
- Olmazsa: hedef kitlenin büyük bir bölümü kaynakçayı elle düzeltir.

### 3. Tanışma cevaplarına göre varsayılanlar
WO-024'te toplanmaya başlanan "ne yapıyorsun / ne için" cevapları bugün
yalnız ölçüm için. Ürüne geri dönebilmeleri için:
lisans → sade arayüz ve ödev şablonu; yüksek lisans/doktora → enstitü tez
şablonu (YÖK Tez Yazım Kılavuzu düzeni); akademisyen → makale şablonu.
Biçim seçicide varsayılan seçili gelir, kullanıcı değiştirebilir.
- Ölçüm: biçim seçicide varsayılanın değiştirilmeden kabul edilme oranı.

### 4. Danışmana salt okunur paylaşım ve yorum
Öğrenci–danışman döngüsü bugün DOCX'i e-postayla gidip gelerek dönüyor.
Taslağın salt okunur bağlantısı ve paragrafa yorum (seçim menüsünde "Yorum"
zaten "Yakında" olarak duruyor) bu döngüyü ürünün içine alır.
- Ön koşul: madde 1 (taslak sunucuda).
- Ölçüm: paylaşılan taslak sayısı, yorum başına dönüş süresi.

### 5. Kendi PDF'ini kanıt kaynağı olarak ekleme
Bugün pasaj çoğunlukla özetten geliyor (2.8'de dürüstçe söyleniyor).
Kullanıcının zaten erişebildiği tam metni (kendi indirdiği PDF) yüklemesi,
pasajı tam metinden almanın lisans sorunu yaratmayan yolu: dosya
kullanıcının, ürün yalnız ondan alıntı yapar.
- Ölçüm: tam metinden gelen pasaj oranı; "kısmen" yerine "destekliyor" alan cümle oranı.
- Risk: dosya saklama ve KVKK; iş emri gerekir.

### 6. Konu takibi
Kayıtlı bir aramaya haftalık "yeni çıkanlar" bildirimi (OpenAlex/arXiv
tarih filtresi). Tez süresince literatürün eskimesini önler. Bildirim
e-postası Resend altyapısıyla gönderilebilir.
- Ölçüm: açılan bildirim oranı; bildirimden sepete eklenen makale.

### 7. Zotero ile iki yönlü bağlantı
Akademisyenlerin çoğunun kütüphanesi Zotero'da. Bugün yalnız BibTeX/RIS
dosyası ile tek yönlü. Zotero Web API ile "koleksiyonumu getir" ve
"sepetimi Zotero'ya gönder".
- Olmazsa: kullanıcı iki araç arasında elle kopyalamaya devam eder; ürünü bırakmaz ama sürtünme kalır. (Önceliği bu yüzden düşük.)

## Önerilmeyenler (testi geçmedi)
- **AI dedektörü, intihal puanı:** 2.2 ve 2.8 ile çelişir; kalibre olmayan puan.
- **Serbest paragraf üretimi:** 2.2 kapsam dışı.
- **TOPSIS / ELECTRE:** `siralama-yontemi-degerlendirmesi.md`.
