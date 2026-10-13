# Çalışma alanı: araştırma ve yazım tek panelde

**Durum:** vizyon (2026-10-13). Ayrıntılı tasarım ve her tuşun işlevi:
`yazar-paneli.md` + görsel taslak `mockup-yazar-paneli.html`.

**Durum:** vizyon (2026-10-13). Bağlayıcı değil; uygulama iş emirleriyle olur.
Bağlayıcı kurallar `CLAUDE.md`'de. Dayanak: kullanıcının 2026-10-13 isteği ve
`atif-dogrulamali-yazim-motoru.md` (Arayüz yerleşimi, Diyagram paneli, Analiz
paneli, Eklenti mimarisi).

## İstek

> Çok güzel bir SaaS paneli olması lazım. Bir sürü öğrenme yöntemi olmalı;
> metni anlayıp napkin.ai gibi göstermeli. Araştırma ve makale yazma işi tek
> panelde olacak. Excel'deki sayfa ayarları, yazı tipi, kalınlık gibi şeyler
> de eklenebilir.

**Yorum (düzeltilebilir):** "öğrenme yöntemleri", kullanıcının literatürü
anlamasına ve öğrenmesine yardım eden araçlar demek (kavram haritası,
hatırlama kartı, kendi cümlenle anlatma …), makine öğrenmesi yöntemleri değil.

## Yerleşim

```
┌──────────────────────────────────────────────────────────────────┐
│ Üst çubuk: tek giriş kutusu — iddia yaz / metin yapıştır / ara   │
├────────────┬─────────────────────────────────┬───────────────────┤
│ Gezinme    │ Belge (geniş)                   │ Sağ panel (dar)   │
│            │                                 │                   │
│ Literatür  │ Biçim çubuğu: yazı tipi, boyut, │ Sekmeler:         │
│ Araştırmacı│ kalın/italik/altı çizili,       │  Kanıt            │
│ Çalışma    │ başlık, hiza, satır aralığı,    │  Kaynaklar (sepet)│
│  alanı     │ liste, tablo                    │  Anla             │
│ Koleksiyon │                                 │  Analiz           │
│            │ Sayfa görünümü: A4, kenar       │                   │
│            │ boşlukları; her cümlenin        │ Her kartta        │
│            │ solunda durum noktası           │ "metne ekle"      │
└────────────┴─────────────────────────────────┴───────────────────┘
```

Tüzükten gelen kurallar:

- Sağ paneldeki hiçbir şey belgeye kendiliğinden girmez; her şey bir tıklamayla girer (2.9).
- Sağ paneldeki her kart bir kaynak pasajına bağlıdır (2.5, 3.1).
- Modlar gizlenmez; tek çalışma alanı vardır (tasarım: "Mod yapma").
- Her panel kendi giriş noktasıdır (2.11): çalışma alanı arama yapılmadan da açılır.

## 1. Belge editörü ve sayfa ayarları

| Özellik | Not |
| --- | --- |
| Yazı tipi, boyut, kalın / italik / altı çizili, vurgu | Biçim çubuğu |
| Başlık 1–3, hizalama, satır aralığı, girinti, madde ve numaralı liste, tablo | Akademik yazımın temeli |
| Sayfa ayarları: kağıt boyutu (A4, Letter), yön (dikey / yatay), kenar boşlukları | Excel / Word "Sayfa Yapısı" karşılığı |
| Üst / alt bilgi, sayfa numarası, sayfa sayfa bölme | Tarayıcıda zor; ayrı iş emri |
| Şablonlar: APA 7 öğrenci makalesi, IEEE, üniversite tez yazım kılavuzu | Kenar boşluğu, yazı tipi, satır aralığı hazır gelir |
| Dışa aktarma: .docx (biçim + sayfa ayarlarıyla), PDF, .bib / RIS | `docx`, `jspdf`, `html2pdf.js` projede zaten var |
| Otomatik kayıt | İlk adımda tarayıcıda; sunucu kaydı veri modeli iş emriyle (şema göçü, kural 6) |

Editör yalnızca yazım aracıdır: AI çıktısı buraya kendiliğinden girmez.

## 2. Anla sekmesi: öğrenme yöntemleri

Her yöntem 2.12'nin dört sorusundan geçer. Ortak kural: çıktının her parçası
bir kaynak pasajına bağlıdır; bağlanamayan parça gösterilmez (2.8).

| Öncelik | Yöntem | Ne yapar | Kaynağa bağı | Motor |
| --- | --- | --- | --- | --- |
| 1 | Kendi cümlenle anlat (Feynman) | Kullanıcı anladığını kendi cümleleriyle yazar; sistem her cümleyi pasajlara karşı doğrular (destekliyor / kısmen / çelişiyor) | Her cümle → pasaj + sınıf | PR3 — ürünün çekirdek doğrulama motoru, ek motor gerekmez |
| 2 | Kavram haritası (napkin.ai benzeri) | Seçili metin ya da makalelerden kavramlar ve ilişkiler diyagramı; "görsel olarak ekle" ile belgeye | Her düğüm ve kenar → kaynak cümle | PR6 |
| 3 | Makale kartı | Amaç, yöntem, örneklem, bulgu, sınırlılık; bulunamayan alan "bulunamadı" yazar | Her alan → pasaj | PR7 genişletmesi |
| 4 | Karşılaştırma matrisi | Makaleler × boyutlar tablosu (yol haritası P3: sentez matrisi) | Her hücre → pasaj | PR7 + PR3 |
| 5 | Hatırlama kartları + aralıklı tekrar | Pasajdan soru–cevap kartı; cevap birebir pasajdır; tekrar planı algoritmayla (FSRS / SM-2), modelle değil | Cevap = pasaj | Soru için küçük model |
| 6 | Tartışma haritası | Kim kimi destekliyor, kim çelişiyor; zaman çizelgesi | Her bağ → iki pasaj + sınıf | PR3 |
| 7 | Yöntem dağılımı | "Bu soruyu soran 14 makalenin 6'sı ANOVA kullanmış" | Her sayı → analiz edilen makaleler | PR7 |

**Neden 1. sıra "kendi cümlenle anlat":** öğrenme aracı ile ürünün çekirdeği
aynı motor. Kullanıcı yazar, sistem kanıtla karşılaştırır — tasarımdaki "A
yönü" tam olarak bu. Yeni model, yeni prompt gerekmez; doğrulama dilimi
bitince bedavaya gelir.

**Yapılmayacaklar:** serbest sohbet eden "AI öğretmen" (2.2: sohbet arayüzü
değiliz), kaynaksız özet, "bölümü benim için yaz" (2.2).

## 3. Eklentiler

Tasarım kararı geçerli: eklenti sistemi şimdi kurulmaz. Anla ve Analiz
sekmelerindeki her araç aynı iç arayüzle yazılır (`AnalysisModule`: kimlik,
etiket, alanlar, ne zaman uygulanır, çıktı). Üç araç çalışır ve dışarıdan
gerçek talep gelirse bu arayüz eklenti API'sine açılır.

## 4. Teknik adaylar

Lisanslar doğrulanmadı; bağımlılık eklenmeden önce okunur ve iş emrinin
raporuna yazılır (`CLAUDE.md` kural 6, 2.7).

| Araç | İş | Not |
| --- | --- | --- |
| TipTap (ProseMirror) | Editör; ileride cümleye `claim_id` çapası | `docs/tools.md`'de var. Çekirdek açık kaynak; sayfalama ve .docx gibi bazı eklentileri ücretli olabilir — yalnız açık lisanslı parçalar |
| CSS `@page`, Paged.js | Sayfa görünümü; yazdırma ve PDF'te kağıt boyutu ve boşluk | Paged.js lisansı doğrulanacak |
| `docx` (projede var) | Biçimli .docx: sayfa boyutu, yön, kenar boşluğu, yazı tipi | `client/src/hooks/useExport.js` zaten kullanıyor |
| React Flow (`xyflow`) | Kavram haritası | `docs/tools.md`'de var |
| `ts-fsrs` ya da elle SM-2 | Aralıklı tekrar planı | SM-2 kütüphanesiz yazılabilir |

## 5. Önerilen sıra

İş emri değildir; iş emirleri `docs/work-orders/README.md` kuralına göre tek
tek açılır.

1. **WO-003 — Çalışma alanı iskeleti** (taslak yazıldı): sekme, iki bölme,
   editör, biçim çubuğu, sayfa ayarları, .docx / PDF. AI yok.
2. **Kanıt paneli, ilk dikey dilim:** iddia → pasaj arama (Europe PMC +
   OpenAlex; Semantic Scholar lisansı doğrulanınca) → PR3 → kanıt kartı.
   Tasarım yol haritasının 1. maddesi.
3. **Kendi cümlenle anlat:** 2'nin motorunu kullanır.
4. **Kavram haritası** + "görsel olarak ekle".
5. **Makale kartı** ve **karşılaştırma matrisi**.
6. **Hatırlama kartları.**
7. **Bugünkü yazım paneli (AI Yazar):** çalışma alanına taşınır ya da
   kapatılır. 2.2 ile çelişen "bölüm üret" kısmı burada karara bağlanır.

## Açık sorular

- "Öğrenme yöntemleri" yorumu doğru mu?
- İlk tez şablonu hangi üniversitenin yazım kılavuzu olsun?
- Gezinme: bugünkü üst sekmeler mi, soldaki menü mü?
- Belgeler ilk adımda yalnız tarayıcıda tutulsun mu?
