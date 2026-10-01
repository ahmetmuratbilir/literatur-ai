# Veri katmanı — ilerleme ve devir notu

> ## 🔴 EN ÖNEMLİ BULGU — buradan devam et
>
> **`.env` dosyasındaki dört değer, `.env.example` şablonundaki yer tutucu
> metinlerle BAYT BAYT AYNI.** Yani o anahtarlar hiç girilmemiş.
>
> | Değişken | Durum |
> |---|---|
> | `CORE_API_KEY` | şablon metni (22 karakter = `your_core_api_key_here`) |
> | `SCOPUS_API_KEY` | şablon metni (33 karakter = `your_elsevier_scopus_api_key_here`) |
> | `OPENALEX_MAIL` | şablon metni (`research-contact@example.com`) |
> | `MONGODB_URI` | şablon metni → **veritabanı erişilemiyor** (`ENOTFOUND`) |
> | `CLERK_SECRET_KEY` | tanımlı değil → korumalı uçlar 401 |
>
> **Bu, önceki teşhisi düzeltiyor.** CORE ve Scopus'un 401 vermesi "anahtar
> iptal edilmiş" değil, **anahtar hiç yok** demek. Yenileme başvurusu yapmanın
> anlamı yok; sıfırdan alınacak. Ben de ilk raporda anahtarların `.env`'de
> yapısal olarak temiz olduğunu söyleyip (boşluk/tırnak/kodlama yok) daha basit
> açıklamayı atlamıştım: değerler şablonun kendisi. `verify-keys` bunu zaten
> "şablon metni girilmiş" diye söylüyordu.
>
> **Sıradaki iş bu değil de şu olmalı:** `MONGODB_URI` ve `CLERK_SECRET_KEY`
> gerçek değerlerle doldurulmadan uygulama zaten çalışmıyor (geçmiş,
> koleksiyon, paylaşım, RAG ve tüm korumalı uçlar kapalı). M2/M3'e geçmeden
> önce bu ikisi halledilmeli.
>
> Not: benim `.env` düzenlemem yalnızca `SEMANTIC_SCHOLAR_API_KEY` satırını
> yorumlamak ve `SCOPUS_ENABLED=false` eklemek oldu. Yedek: `.env.bak.m0.*`


Plan dosyası: https://claude.ai/artifact/7DqB4iGsPVBxGovuvtscn9
Son güncelleme: 2026-09-30

Bu dosya oturumlar arası devir içindir. Bir maddeyi bitirince `[x]` yap ve
"Not" satırına ne değiştiğini yaz. Yeni oturumda önce bu dosyayı oku.

---

## Kanıtlanmış teşhis bulguları (30 Eyl 2026, canlı HTTP ile ölçüldü)

Bunlar tahmin değil, ölçüm. Tekrar test etmeye gerek yok.

| Kaynak | Bulgu | Kanıt |
|---|---|---|
| Semantic Scholar | Anahtar reddediliyor | Anahtarlı 403, **anahtarsız 200**, kasıtlı bozuk anahtar da aynı 403 |
| CORE | Anahtar geçersiz | 3 uç + 2 auth biçiminde 401; bozuk anahtarla birebir aynı mesaj |
| Scopus | Anahtar Elsevier kaydında yok | Scopus **ve** ScienceDirect 401 `APIKEY_INVALID`; değer 33 karakter ve hex değil |
| DOAJ | Sessiz 0 | Kodun sorgusu `total: 0`; aynı kelimeler `OR` ile **1.150.609**; tırnaklı iki ifade `OR` ile **68** |
| OpenCitations | Her çağrı 400 | v1 `doi:` önekini kabul etmiyor, v2 zorunlu tutuyor. Kod v1'i önekle çağırıyor |
| arXiv | Sıfır değil, gürültü | Türkçe yarıyı yok sayıyor (havuz 150.856, salt İngilizce ile birebir aynı); tırnaklı ifade → 9 |
| OpenAlex | Çalışıyor, anahtar gerekmiyor | Anahtarsız 200, `x-ratelimit-limit: 1000`. **Geçersiz `api_key` ile 401** → yanlış anahtar eklemek tek sağlam kaynağı düşürür |
| Crossref geri çekme | Mevcut, ucuz | `update-to` / `updated-by`, `source: retraction-watch`. `filter=update-type:retraction` → **75.865 kayıt** |
| DOAJ dergi ucu | Çalışıyor | `/api/search/journals/issn:1932-6203` → PLoS ONE. Ama toplu `/csv` **403** |

`.env` anahtarları yapısal olarak temiz: boşluk/tırnak/ASCII-dışı/CR yok, satır sonu LF.
Yani kopyalama hatası değil. CORE değeri 22 karakter — panelle karşılaştırılmalı.

---

## M0 — Kanı durdur ✅ BİTTİ (30 Eyl 2026)

- [x] `SEMANTIC_SCHOLAR_API_KEY` devre dışı — `.env`'de yorum satırına alındı
      (değer silinmedi). Yedek: `.env.bak.m0.*`
- [x] Semantic Scholar 401/403'te anahtarı bırakıp anahtarsız tekrar deniyor
- [x] OpenCitations → `/index/api/v2/citation-count/doi:{doi}`
- [x] `openalex.js` ölü `apiKey` değişkeni kaldırıldı, yerine neden
      eklenmemesi gerektiğini açıklayan yorum kondu
- [x] Scopus `SCOPUS_ENABLED` bayrağı arkasında, varsayılan `false`.
      Atlanan kaynak `failedSources`'a girmiyor (uyarı gürültüsü bitti)
- [x] `services/sourceQuery.js` — kaynak başına sorgu çevirici
- [x] `tests/sourceQuery.test.js` — 13 test. Takım: **129/129 geçiyor**

### Ölçülen sonuç (üretim fonksiyonları çağrılarak, elle URL yazmadan)

| Kaynak | Önce | Sonra |
|---|---|---|
| DOAJ | havuz **0** (sessiz) | havuz **68**, 10 kayıt |
| arXiv | havuz **150.856** (gürültü) | havuz **9** (tam isabet) |
| OpenCitations | **0/2** doğrulanan, her çağrı 400 | **2/2**, gerçek atıf sayıları (1806 / 5) |
| Semantic Scholar | her istek **403** (kaynak tamamen düşük) | anahtarsız ortak havuz, **aralıklı 429** |

Üretilen sorgular:
- DOAJ → `("nükleer reaktör güvenliği" OR "nuclear reactor safety")`
- arXiv → `all:"nuclear reactor safety"` (Türkçe hiç gönderilmiyor)
- S2 → `nuclear reactor safety` (düz metin, bool yok)

**Açık kalan:** Semantic Scholar anahtarsız ortak havuzda 429 alıyor. Bu
beklenen ve planda yazılı davranış — "her zaman ölü" yerine "aralıklı çalışır"
oldu. Yeni anahtar gelince `.env`'deki yorum satırı açılır.

## M1 — Bir daha sessizce bozulmasın — ÇEKİRDEK BİTTİ (30 Eyl 2026)

- [x] `keyHealthService` elle URL yerine üretim fonksiyonlarını çağırıyor
      → yeni modül `services/sourceCanary.js`
- [x] Eşik testi (canary): `MIN_EXPECTED` — kaynak başına asgari sonuç sayısı.
      Altına düşülürse durum `ok` değil **`zero_results`**
- [x] `SOURCE_ZERO` yapılandırılmış logu (`search.js`) + yanıtta
      `zeroResultSources` alanı. Havuz>0 ise "normalizasyon", havuz=0 ise
      "sorgu eşleşmedi" ipucu veriyor
- [x] `verify-keys` çıktısına `SONUÇ YOK` / `KAPALI` / `KULLANILMIYOR` durumları
- [x] Ölü env değişkeni uyarısı → `findDeadEnvVars()` (OPENALEX_API_KEY tuzağı)
- [x] `tests/sourceCanary.test.js` (6 test) + `keyHealthService.test.js`
      güncellendi. Takım: **137/137 geçiyor**

### Yeni `verify-keys` çıktısı (30 Eyl 2026)

```
  Scopus            KAPALI            SCOPUS_ENABLED=false — arama akisinda degil
· OpenAlex          HATA              503 (geçici) — polite-pool: aktif
  Crossref          OK                10 sonuc / havuz 2.102.653
  DOAJ              OK                10 sonuc / havuz 68        <- önce sessiz 0
  arXiv             OK                9 sonuc / havuz 9          <- önce havuz 150.856
· Semantic Scholar  KOTA DOLU         anahtarsiz ortak havuz (429)
· CORE              ANAHTAR GEÇERSİZ  anahtar reddedildi
  OpenCitations     OK                1 sonuc / havuz 1.806      <- önce her çağrı 400
! Clerk             TANIMSIZ          CLERK_SECRET_KEY yok
! MongoDB           ERİŞİLEMİYOR      ENOTFOUND (şablon URI)
```

**Durum modeli artık üçlü:** `ok` / arıza / nötr (`skipped`, `unused`).
`ok + failing === total` varsayımı bilerek düşürüldü — kapatılmış bir kaynağı
arıza saymak paneli gereksiz kırmızıya boyuyordu.

### M1'de kalan (yapılmadı)

- [ ] Üst üste *n* aramada 0 döndü sayacı (şu an tek aramalık log var, seri yok)
- [x] **Crossref geri çekme kontrolü** ✅ (30 Eyl 2026)
  - Yeni modül `services/retraction.js`: `parseRetraction()` (saf) +
    `checkRetractions()` (toplu `filter=doi:a,doi:b`, 20'lik batch) +
    `annotateRetractions()` (sonuçlara `retraction` alanı yazar)
  - `crossref.js` `select=` listesine `updated-by` eklendi → Crossref kaynaklı
    kayıtlar için ikinci istek yok
  - `search.js`: OpenCitations ile **paralel** çalışıyor; yanıtta
    `retraction: { retracted, concern, checked, failed }`
  - `searchRankingService.js`: tekilleştirmede en ağır durum kazanıyor
  - `ahp.js`: geri çekilen → güvenilirlik 0, toplam ×0,1, açıklamanın **ilk**
    maddesi uyarı. Listeden atılmıyor, en alta iniyor. Endişe bildirimi → −0,3
  - `ResultCard.jsx`: başlık altında tam genişlik uyarı şeridi + bildirim linki
  - `tests/retraction.test.js`: 14 test, fixture'lar gerçek Crossref yanıtından.
    Takım **150/150**
  - Canlı doğrulama: Wakefield → retracted (2010), Mehra → retracted,
    Nature 2013 → none, arXiv DataCite DOI → **unknown** (Crossref'te yok;
    "temiz" demek yanlış olurdu). 4 DOI, tek istek, 612 ms
  - **Kurallar (ölçümden):** karar yalnızca `updated-by`'dan; `update-to`'ya
    bakmak geri çekme *bildiriminin kendisini* işaretler. Listenin ilk kaydına
    bakmak yanlış — Wakefield'da ilk kayıt 2004 correction, geri çekme ikinci.
    Önceki notumdaki "Wakefield'daki şey correction" ifadesi eksikti: 220
    karakterde kesilmiş çıktıya bakmıştım, geri çekme listede var.
  - **Yapılmadı:** 75.865 DOI'lik yerel hasat. MongoDB erişilemediği için
    (şablon URI) test edilemez; şimdilik arama başına toplu sorgu yeterli.
    Mongo gelince hasat + yerel kontrol eklenebilir, arama bütçesinden 600 ms kazanır.
- [x] **OpenAlex anahtarı artık gönderiliyor** ✅ — önceki kararın düzeltmesi
  - Yeni ölçüm (30 Eyl 2026, öğleden sonra): OpenAlex **anonim aramayı 429 ile
    kesiyor**: *"Anonymous search is temporarily rate-limited while the search
    cluster is under elevated load … use a free API key"*. Önceki `verify-keys`
    çıktısındaki 503 de muhtemelen buydu.
  - Yani "anahtar gerekmiyor" ölçüldüğü anda doğruydu ama tek sağlam kaynak yük
    altında anonim kullanıcıyı ilk kesiyor. Doğru çözüm: **gönder ama doğrula.**
  - `openalex.js`: `OPENALEX_API_KEY` tanımlıysa `api_key` olarak ekleniyor
    (loglarda `maskUrlSecret` gizliyor). Geçersiz anahtar → 401 → canary
    `ANAHTAR GEÇERSİZ` gösterir
  - `findDeadEnvVars`'tan OpenAlex uyarısı kaldırıldı; `envValidation` ve
    `.env.example`'a değişken eklendi. Takım **151/151**
  - **Senin yapacağın:** openalex.org'dan ücretsiz anahtar al, `.env`'e
    `OPENALEX_API_KEY=` olarak yaz, sonra `npm run verify-keys`

- [x] **DOAJ dergi doğrulaması** ✅ — test edildi (156/156), client lint + build temiz
  - OpenAlex kaynak nesnesi `is_in_doaj` taşıyor, DOAJ ile iki yönde tutarlı
  - Rozet yalnızca olumlu durumda, AHP'ye girmiyor (kapalı erişimli saygın
    dergiler cezalandırılmasın diye)

- [x] **Üst üste sıfır sayacı** ✅ — `services/sourceZeroTracker.js`
  - 5 ardışık aramada hata vermeden 0 dönen kaynak → `SOURCE_ZERO_STREAK`
    (tek sefer), toparlanınca `SOURCE_ZERO_RECOVERED`
  - Hata veren / kapalı kaynaklar sayılmaz (onlar `failedSources`'ta)
  - Admin `/api/admin/verify-keys` yanıtında `zeroStreaks` alanı
  - Bellekte tutuluyor, yeniden başlatmada sıfırlanır (bilinçli)
  - 4 test. Takım **160/160**

### ✅ M1 BİTTİ (30 Eyl 2026)

### `listed_in` araştırması — sonuç: teşvik için OLUMSUZ

OpenAlex `primary_location.source.listed_in` değerleri (50 kayıt):
`cwts-core`, `jufo-1/2/3`, `norway-1/2`, `doaj`, `medline`, `erih-plus`,
`abdc-a`, `ki-jl-1/2`, `doyens`.

- **Scopus, SCI/SSCI/AHCI, ESCI, TR Dizin YOK** → "Teşvik/terfi" profili
  için veri kaynağı değil. Profil kapalı kalıyor.
- **Ama:** AHP kalite kriteri için ücretsiz, savunulabilir bir sinyal olabilir.
  JUFO (Finlandiya, 3 en yüksek) ve Norveç kaydı (2 en üst) uzman panellerinin
  puanladığı ulusal listeler. Şu an kalite kriteri neredeyse boş çalışıyor
  (`JOURNAL_DATABASE` 6 dergi, `quartile` hep null).
- **KARAR BEKLİYOR (kullanıcı):** bunlar sıralama metodolojisini ve jüriye
  anlatılan şeyi değiştirir. Onay olmadan bağlanmadı.

## M2 — Türkçe kaynaklar (ölçümle yeniden planlandı, 30 Eyl 2026 gece)

**Ölçülen:**
- DergiPark OAI-PMH ÇALIŞIYOR: `https://dergipark.org.tr/api/public/oai/`
  Identify/ListSets/ListRecords 200; sayfa 100 kayıt, ~1 sn; TR+EN başlık.
  `resumptionToken` yalnızca `expirationDate` taşıyor → toplam kayıt sayısı
  OAI'dan öğrenilemiyor
- Kayıt boyutu (300 gerçek kayıt, bizim şema): ort. **3,8 KB** tam özetle,
  1,5 KB özet 300 karakterle. 728 bin kayıt → **~2,6 GB** (indeks hariç) →
  Atlas ücretsiz katmanına (512 MB) SIĞMAZ
- DOI oranı (OAI datestamp örneklemi): 2026 %100 · 2020 %81 · 2016 %65
- **DOI'li DergiPark makaleleri OpenAlex'te: 50/50 (her üç yılda), hepsi
  özetli.** Dil: 2026'da 37 en / 13 tr; 2016'da 11 en / 39 tr
- OpenAlex `language:tr`: 1.210.025 eser; tr + "öğretmen" → 70.665.
  Filtreli liste 1 kredi, arama 10 kredi

**Yeni plan:**
- [ ] **A — şimdi, MongoDB'siz:** "Türkçe kaynaklar dahil" profili seçilince
      İngilizce aramaya EK olarak özgün Türkçe metinle
      `filter=language:tr&search=...` (OpenAlex). +10 kredi/arama, yalnızca bu
      profilde. ⚠ Kullanıcının "hep İngilizce" kuralına istisna — ONAY BEKLİYOR
- [ ] **B — MongoDB gelince:** YALNIZCA DOI'siz DergiPark kayıtlarını topla
      (DOI'liler OpenAlex'ten geliyor). Kısa özetle ücretsiz katmana kabaca
      sığar — gerçek sayıyla hesaplanacak. TR Dizin bayrağı dergi sayfalarından
- [ ] Atlas Search Türkçe analizörü (B için)
- Engel: lokal `MONGODB_URI` şablon; kullanıcı Render'daki gerçek URI'yi girecek

## M3 — AHP ağırlıkları kullanıcıya (7–8 gün) — BACKEND BİTTİ (30 Eyl 2026)

- [x] **ÖN KOŞUL — önbellek AHP öncesi havuzu tutuyor** ✅
  - `services/rankingPipeline.js`: `rankFromPool(pool, {weights, translations})`
    hem canlı aramada hem önbellek isabetinde çalışıyor → aynı ağırlık, aynı sıra
  - Önbellek kaydında `_cache: { pool, translations }`; istemciye gitmiyor
  - Çeviriler makale anahtarıyla (DOI > id > başlık) saklanıyor, yalnızca
    **eksik** olanlar çevriliyor (ağırlık değişince pratikte ilk 10'a yeni
    girenlerin özetleri)
  - Havuzsuz eski kayıt: yalnızca varsayılan ağırlıkla servis edilir, özel
    ağırlıkta canlı aramaya geçilir
  - Önbellek sürümü `v6-pool-rerank` — M0/M1 öncesi kırık kayıtları da geçersiz kılıyor
  - ⚠ MongoDB erişilemediği için önbellek yolu **canlıda test edilmedi**;
    saf fonksiyonlar birim testli
- [x] `services/ahpProfiles.js` — 6 profil (2'si kapalı + sebep), özel
      ağırlık doğrulama, kriter başına **%50 üst sınır** (fazlası orantılı
      dağıtılır), bozuk girdide uyarıyla varsayılana dönüş
- [x] `/api/search?profileId=guncel` veya `&weights={"recency":0.4,...}`
      → yanıtta `ranking: { profileId, source, weights, warnings }`
- [x] `GET /api/ranking/profiles` — profil listesi + metodoloji (herkese açık)
- [x] `getWeightingMethodology()` artık `appliedWeights` da döndürüyor
      (matrisin türettiği ≠ uygulanan olabilir; CR matrise aittir)
- [x] `tests/ahpProfiles.test.js` — 18 test. Takım **178/178**
- [x] **İstemci: profil kartları** ✅ — `client/src/components/RankingProfiles.jsx`
  - Profil listesi sunucudan (`/api/ranking/profiles`), istemcide kopya yok
  - Kapalı profiller silik ama sebebi yazılı; seçim `localStorage`'da
  - Profil değişince `handleProfileChange` yalnızca **yeniden sıralıyor**
    (`handleSearch` AI analizini/seçimleri siliyor ve geçmişe ikinci kayıt
    ekliyordu, o yüzden çağrılmıyor)
- [x] **İstemci: "Neden bu sırada?"** ✅ — `RankBreakdown.jsx` +
      `utils/rankBreakdown.js`. Katkı = `appliedWeights[c] × scores[c]`, ilk 4,
      puan alamayan kriterler sebebiyle, geri çekme cezası notu
- [x] Client lint + build temiz. Takım **178/178**
- [x] `ahp.js` başındaki eski ağırlık yorumu düzeltildi
- [x] **Canlı doğrulama:** aynı 25 makalelik havuz (OpenAlex 25, Crossref 25,
      DOAJ 25, arXiv 9) → 4 profilde 4 farklı ilk üç

### Kullanıcı kararları (30 Eyl 2026, akşam)

1. **Eksik bilgi → o kriterde 0** (tüm profiller). ✅ UYGULANDI
   - Güncellik: yıl yoksa 0 (önce 0,5)
   - Atıf: yıl yoksa atıf sayısı yok sayılmaz, makale 25 yaşında kabul
     edilir (güncelliğin 0 olduğu yaş — iki kriter aynı varsayım)
   - Kalite: yayın/kaynak türü bilinmiyorsa o alt puan 0 (önce 0,4 / 0,5)
   - Çok atıflı tarihsiz makale yine yukarı çıkabilir — kullanıcı bunu kabul etti
   - `tests/missingData.test.js` (5 test), takım **195/195**; metodoloji
     penceresi ve "Neden bu sırada?" metinleri güncellendi
2. **Konu dışı sonuç istenmiyor; arama her zaman İngilizce.** ✅ UYGULANDI
   - `sourceQuery.js` baştan yazıldı: tüm kaynaklara yalnızca İngilizce
     (çeviri varsa o, yoksa özgün). Türkçe özgün `phrase.original`'da duruyor
     (DergiPark gelince yalnızca o kaynak için)
   - ≤4 kelimelik ifade tam ifade (tırnaklı), daha uzunu kelime kelime
   - **M0 REGRESYONU BULUNDU VE DÜZELTİLDİ:** AI analizinin boolean sorgusu
     M0'dan beri tek tırnaklı diziye dönüşüyordu → DOAJ 791→**0**, OpenAlex→**0**,
     arXiv→0. Artık gerçek bir boolean ayrıştırıcı var (`tokenizeBoolean`):
     OpenAlex/DOAJ/CORE boolean alır, arXiv alan önekli (`all:`, `ANDNOT`),
     S2/Crossref düz kelime. Canlı: OpenAlex 25, DOAJ 25, arXiv 25
   - **Skorlama hatası:** `cleanQuery` Türkçe konuyu iki kez içeriyordu;
     `toTokenSet` NFKD yüzünden "nükleer"i "nu"+"kleer" diye bölüyordu;
     benzerlik paydası şişiyor, tam ifade bonusu hiç çalışmıyordu. Artık
     skorlama İngilizce metinden, aksanlar doğru soyuluyor ("nukleer")
   - **Alaka eşiği** (`relevanceGate`): sorgunun AND yapısı (`queryClauses`) —
     her AND grubundan en az bir alternatif; alternatif için n kelimeden
     `max(2, ⌈n/2⌉)` (n=1 → 1). Havuz seçiminden ÖNCE uygulanıyor (25 slot
     konu içi dolsun) ve AHP'de de. Tam eşleşen yoksa `partial` (en az bir
     kelime), hiç eşleşmeyen ASLA. Eski filtre 5'ten az geçerse filtreyi
     tamamen kaldırıyordu
   - Yanıtta `relevance: { level, dropped }`
   - **Canlı doğrulama (OpenAlex cevap verirken):** "Global Linear
     Instability" artık yok; "En çok atıf alanlar" ilk 8'in hepsi konu içi;
     17 konu dışı elendi
   - Not: AI sorgusu testinde "LoRA … Language Models" makalesini konu dışı
     sandım; tam başlık "…for Nuclear Reactor Safety" — meşru sonuç
   - Testler: `sourceQuery.test.js` baştan (15), `relevanceGate.test.js` (9).
     Takım **205/205**
3. **Türkçe çeviri isteğe bağlı, varsayılan İngilizce.** ✅ UYGULANDI
   - `/api/search?translate=tr` yoksa çeviri yapılmaz (LLM çağrısı da yok)
   - `rankFromPool` varsayılanı `translateEnabled = false`; kapalıyken
     önbellekteki çeviriler de uygulanmaz ama silinmez
   - Önbellek isabetinde üretilen çeviriler `updateSearchCacheTranslations`
     ile kayda yazılıyor (sonraki "Türkçeye çevir" diyen için LLM tekrarı yok)
   - İstemci: sonuç çubuğunda "Türkçeye çevir" kutusu (localStorage),
     "konu dışı N sonuç elendi" notu, `partial` eşleşmede uyarı kutusu
   - **Kapsam: YALNIZCA BAŞLIKLAR** (kullanıcı kararı). Özet çevirisi
     kaldırıldı; önbellekte eski özet çevirisi olsa bile uygulanmıyor.
     Canlı: 3 başlık, tek istek, ~1,1 sn ("CFD" → "HAD" gibi terimleri doğru çeviriyor)
   - Arama metni çevirisi: **DeepSeek** (`deepseek-flash`, `translateToEnglish`).
     Canlı: "öğretmenlerin dijital okuryazarlık düzeyleri" → "teachers'
     digital literacy levels" (~0,9 sn). index.js'teki eski "Google Translate"
     yorumu düzeltildi. Takım **207/207**

### Canary'ye AI sorgusu eklendi
`OpenAlex (AI sorgusu)` ve `DOAJ (AI sorgusu)` satırları. M0 regresyonu
düz konu yoklamasından kaçmıştı. Ölçüm: DOAJ AI sorgusu **787** (regresyonda 0).
Takım **206/206**, client lint + build temiz.

### (Eski) Canlıda görülen iki sorun

1. **"Güncel araştırmalar" profilinde yılı bilinmeyen makale 3. sırada.**
   Eksik yıl → güncellik skoru 0,5 (nötr = ~12,5 yaşında). Havuzun çoğu
   2007–2011 olduğu için tarihsiz makale onlardan "daha güncel" sayılıyor.
   Seçenekler: (a) güncellik ağırlıklı profilde eksik yılı 0'a çek,
   (b) eksik yılı genel olarak 0,25 yap (tüm profilleri etkiler),
   (c) olduğu gibi bırak, kartta "yıl bilinmiyor" zaten yazıyor.
   Metodolojiyi değiştirdiği için onaysız yapılmadı.
2. **"En çok atıf alanlar" konu dışı makale getirebiliyor.** 2. sırada
   "Global Linear Instability" (733 atıf, akışkanlar dinamiği) var. Atıf
   ağırlığı 0,40 zayıf alakalı ama çok atıflı makaleyi yukarı taşıyor.
   Seçenek: bu profilde konu uyumu için asgari eşik (şu an `calculateAHP`
   yalnızca `sKey < 0,15 && sSim < 0,20` olanları eliyor).

- [x] **Gelişmiş mod — sunucu** ✅ `services/ahpPairwise.js`
  - `ratingsToWeights()` — kaydırıcı 1–5 → Saaty (1,2,3,5,7). CR uygulanmaz
    ve yanıtta bu açıkça yazıyor (tek vektörden matris tanım gereği tutarlı)
  - `evaluatePairwise()` — en fazla 4 kriter (6 soru); seçilmeyenler
    varsayılan payını korur; n=2'de CR tanımsız → tutarlı
  - `worstInconsistentTriad()` — log-sapması en büyük üçlü, düz Türkçe:
    *"Güncellik, atıf yoğunluğu kriterinden belirgin şekilde daha önemli ve
    atıf yoğunluğu, yayın kalitesi kriterinden biraz daha önemli dedin. Bu iki
    tercih birlikte "güncellik, yayın kalitesi kriterinden kesinlikle daha
    önemli" sonucunu gerektiriyor, ama yayın kalitesi, güncellik kriterinden
    biraz daha önemli işaretledin."* (CR = 1,585)
  - `POST /api/ranking/evaluate` `{mode:'ratings'|'pairwise', ...}`
  - `tests/ahpPairwise.test.js` — 10 test. Takım **188/188**
- [x] **Gelişmiş mod — istemci** ✅ `client/src/components/AdvancedWeights.jsx`
  - Kaydırıcılar (7 kriter, 1–5, canlı % önizleme) + ikili sorular
    (≤4 kriter, 5 seçenek: 7 / 3 / 1 / ⅓ / ⅐)
  - Çelişki kutusu: düz Türkçe açıklama + öneri + `[Öneriyi uygula]` /
    `[Olduğu gibi devam et]`. Devam edilirse sonuç başlığında "çelişen
    tercihlerle üretildi" notu (gizlenmiyor)
  - Özel ağırlık `localStorage`'da; profil seçilince temizleniyor
  - `App.jsx`: `rerank()` ortak yol — profil ve özel ağırlık aynı istekten geçiyor
- [x] **Öneri algoritması düzeltildi** — `bestSingleFix()`
  - Ölçülen sorun: "çelişen üçlünün üçüncü kenarını düzelt" önerisi, arayüzün
    5 seçeneğiyle 94 tutarsız başlangıcın **30'unda** uygulandıktan sonra da
    tutarsız kalıyordu (ölçek 9'da, arayüz 7'de bitiyor: 7×7=49 temsil edilemez)
  - Yeni kural: CR'yi eşiğin altına indiren değişiklikler arasından **en
    küçüğü**; hiçbiri inmiyorsa CR'yi en çok düşüren. Sunucu yalnızca
    arayüzün sunduğu değerleri öneriyor (`allowedValues`)
  - Sonuç: **86/94** tek adımda düzeliyor; kalan 8'de arayüz dürüstçe
    "tek bir değişiklik yetmiyor" diyor
  - Garanti testli: "düzeltir" denen her öneri gerçekten düzeltiyor.
    Takım **190/190**, client lint + build temiz
- [x] **Metodoloji penceresi** ✅ `client/src/components/MethodologyModal.jsx`
  - Router olmadığı için sayfa değil pencere; "Sıralama nasıl yapılıyor?"
    bağlantısı profil seçicinin başlığında
  - Sayılar sunucudan (`/api/ranking/profiles`): kriter ağırlıkları, λmax,
    CI, RI, CR, profil tablosu. Elle yazılmış sayı yok
  - CR ≈ 0,0006'nın neden bir başarı göstergesi olmadığı açıkça yazıyor
    (jüri bunu soracaktır)
- [x] `ahp.js` başındaki eski ağırlık yorumu düzeltildi

### ✅ M3 BİTTİ (30 Eyl 2026) — istemci arayüzü tarayıcıda GÖRÜLMEDİ

Lint + derleme temiz, sunucu 190/190. Ama sonuç ekranı `CLERK_SECRET_KEY`
olmadan açılmıyor (korumalı uç 401), o yüzden profil kartları, "Neden bu
sırada?", kendi ağırlıklarım paneli ve metodoloji penceresi **render edilmiş
halde hiç görülmedi.** Clerk anahtarı girildiğinde ilk iş bunlara göz atmak.

## Valdecy Pereira repoları — karşılaştırma ve karar (30 Eyl 2026)

Ölçülen gerçekler (GitHub API + pyDecision 5.1.1 geçici venv'de çalıştırıldı):

| Repo | Lisans | Durum | Karar |
|---|---|---|---|
| pyDecision | GPL-3.0+ | 364★, aktif | **Kod alınmadı; doğrulama referansı.** Bizim özvektör hesabımız onun `max_eigen`'iyle 3 matriste **10⁻¹³** farkla aynı. Onun VARSAYILANI (`mean`) yaklaşık: döngüsel matriste 0,023 sapıyor. Değerleri `tests/ahpCrossValidation.test.js`'e fixture olarak kondu (Python gerekmez) |
| pyMissingAHP | GPL-3.0+ | 2★, 2023'ten beri güncellenmiyor | **Yöntemi alınmadı.** Genetik algoritma = rastgele → aynı cevap farklı ağırlık. Ayrıca n−1 yanıtta "en az tutarsızlık" tamamlaması tanım gereği tutarlı (CR bilgisiz). Yerine **Harker (1987)** yazıldı: deterministik, özvektörün eksik matris uyarlaması, tam matriste pyDecision referansını 10⁻⁸ ile tutturuyor |
| Method_3MOAHP | GPL-3.0+ | (metin "3MOAHP" diyordu; adı bu) | Çok hedefli GA ile çok girdiyi değiştiriyor. Kullanıcıya tek, açıklanabilir öneri için bizim `bestSingleFix` (her yanıt × her seçenek, deterministik) daha uygun. Değiştirilmedi |
| Voracious-AHP | **lisans yok** (Java) | — | Kod kullanılamaz (tüm haklar saklı) |
| pybibx | GPL-3.0+ | 221★, aktif | Bibliyometrik analiz; yatırım sonrası "literatür haritası" fikri olarak yol haritasına |

**Uygulanan (Harker):**
- `ahpPairwise.js` baştan: `harkerWeights`, `components` (bağlılık),
  `evaluateComparisons` (eksik yanıt serbest, bağlı olmalı; ağaçta
  `consistencyApplies=false`; çelişkide "hangi yanıt + diğer cevaplar ne diyor")
- Eski "≤4 kriter, tüm çiftler" modu kaldırıldı → **7 kriter, 9 soru**
  (6 zincir + 3 tutarlılık kontrolü, hepsi isteğe bağlı), istemcide canlı
  bağlılık kontrolü
- Öneri başarısı korundu: 94 tutarsızdan **86**'sı tek adımda düzeliyor
- Metodoloji penceresine Harker + pyDecision çapraz doğrulaması eklendi
- Takım **209/209**, client lint + build temiz
- ⚠ Harker künyesi (Mathematical Modelling 9(11), 837–848) **doğrulanmalı**

## Lokal çalıştırma ve tarayıcıda görülen hatalar (30 Eyl 2026, akşam)

**Nasıl açılıyor:** Kullanıcının kendi süreçleri zaten açık:
`server`: `node --watch index.js` (port 3000, `.env`'de `NODE_ENV=development`),
`client`: Vite (port 5173). Client'ta `VITE_CLERK_PUBLISHABLE_KEY` yok →
geliştirme kimliği (`Bearer test-token`) kullanılıyor, arama çalışıyor.
Tarayıcı sürüşü: `puppeteer-core` + sistemdeki Edge, **PowerShell'den**
(Bash ortamı Edge'i başlatamıyor). Koleksiyon uçları 503 (MongoDB yok) — beklenen.

**Arayüz ilk kez görüldü:** profil kartları, kapalı profil sebepleri, "konu
dışı N sonuç elendi", DOAJ rozeti, "Neden bu sırada?", 9 soruluk ikili soru
paneli, metodoloji penceresi — hepsi düzgün render ediliyor.

**Ekranda görülen iki hata (düzeltildi):**
1. **DOAJ yılı hiç okunmuyordu.** `doaj.js` tarih normalleştirmesini
   çağırmıyor, yıl yoksa `|| 2024` UYDURUYORDU. Her DOAJ makalesi "yıl
   bilinmiyor" sayılıp güncellikte 0 alıyordu (eksik bilgi kuralıyla birlikte
   haksız ceza). `dateNormalization.js`'e DOAJ yapılandırması eklendi
   (bibjson.year/month → medium güven). Canlı: DOAJ 15/15 yıl biliniyor (önce 0/15)
2. **OpenCitations atıfları puana hiç yansımıyordu.** `opencitations.js`
   `citationCount` yazıyor, AHP `citedBy` okuyor. Artık `citedBy` da yazılıyor
   (yalnızca citedBy=0 olan makalelerde çalıştığı için başka değeri ezmez).
   Metodoloji penceresindeki "OpenCitations değerlerinin en yükseği" ifadesi
   ancak şimdi doğru. Canlı: 12 makale doğrulandı, atıflar 7/7/20/3/2…
- Takım **212/212**

**Sıralama tercihi aramadan önce** (kullanıcı kararı): `RankingProfiles` +
`AdvancedWeights` sonuç alanından arama formunun içine, "Araştırmayı Başlat"
butonunun üstüne taşındı. Varsayılan "Dengeli" seçili geliyor; aramadan önce
seçilen profil/ağırlık aramada kullanılıyor, sonra değiştirilirse sonuçlar
yeniden sıralanıyor. Kartlar 3'erli 2 satır. Tarayıcıda doğrulandı, sayfa hatası yok.

**Açık kalan:** OpenAlex bu akşamki her aramada anonim kotaya takıldı →
en çok atıflı makaleler (OpenAlex'ten gelenler) listede yok. Çözüm yalnızca
`OPENALEX_API_KEY`.

## M4 — Anahtarsız yeni kaynaklar (30 Eyl 2026)

- [x] **Europe PMC** ✅ canlı aramada — `services/europepmc.js`
  - Anahtar yok; OpenAlex ile aynı boolean sorgu (`sq.openAlex`)
  - Plandan sapma: "yalnızca tıp sorgularında" yerine KOŞULSUZ. Kaynaklar
    paralel, Europe PMC ~0,6 sn (en hızlılardan) → toplam süreyi uzatmıyor;
    konu dışını alaka eşiği eliyor
  - PMID/PMCID korunuyor (birleştirmede de), PPR → preprint, tarih
    normalleştirmesine Europe PMC eklendi (firstPublicationDate → high)
  - **Bulunan boşluk:** `normalizePublicationType("Journal Article")` → null
    idi; PubMed/Europe PMC'nin standart türü. Eksik bilgi kuralıyla her
    makale kalitede 0 alırdı. Eklendi (+ clinical trial, systematic review,
    meta-analysis, case reports)
  - Canary + istemci kaynak kartı (GlobalStats) eklendi
  - Canlı: diyabet sorgusunda nihai listenin 13/25'i, nükleer sorguda 6/25'i
- [x] **Unpaywall** ✅ AKTİF — `UNPAYWALL_EMAIL` kullanıcının açık onayıyla
      `.env`'e eklendi (30 Eyl 2026). Canlı: Nature 2013 → PDF (yayıncı sürümü),
      MDPI → tam metin sayfası, Wakefield → bulunamadı. Tarayıcıda "diyabet
      tedavisi" aramasında 23 kartta düğme, ilk 3'ü PDF buldu, sayfa hatası yok
  - Ölçüm: şablon e-posta (`example.com`) → HTTP 422 "Please use your own
    email address". Kullanıcının e-postası izinsiz dış servise gönderilmedi
  - `GET /api/oa?doi=` — arama sırasında değil, karttaki düğmeyle; 7 gün
    bellek önbelleği (olumsuz sonuç dahil), günde 70.000 güvenli sınır
  - Arama yanıtında `features.unpaywall`; kapalıyken düğme GÖSTERİLMİYOR
  - Kart: "Ücretsiz PDF bul" → bağlantıya dönüşüyor (açılır pencere engeline
    takılmamak için), sürüm etiketi ("yayıncı sürümü" / "kabul edilmiş yazar
    sürümü"), PDF barındırılmıyor
- [ ] **PubMed** — ertelendi (plan gereği): Europe PMC PubMed kayıtlarını ve
      MeSH'i zaten içeriyor; rolü zenginleştirme, arama değil
- [ ] **DergiPark** — ertelendi: canlı arama değil OAI-PMH toplama + yerel
      veritabanı; MongoDB bağlı değil
- Takım **221/221**, client lint + build temiz

## OpenAlex anahtarı AKTİF (30 Eyl 2026, gece)

- Kullanıcı `OPENALEX_API_KEY`'i `.env`'e yapıştırdı; yapısal kontrol temiz,
  canlıda HTTP 200. Loglarda `api_key=***` maskeleniyor
- **Bütçe (kullanıcının panelinden):** günde 1 $ = 10.000 kredi; arama 10
  kredi, tekil kayıt ücretsiz → ~1.000 arama/gün. Ekteki dokümanın "günde 1 $"
  iddiası böylece doğrulandı
- **Ölçüm — maliyet hipotezi YANLIŞ çıktı:** `search=` ve
  `filter=title_and_abstract.search:` İKİSİ DE `meta.cost_usd = 0.001` (10
  kredi). Tasarruf yok; ilk 10 sonucun 9'u ortak. Mevcut `search=` korunuyor
- `x-ratelimit-remaining` kredi sayıyor (her aramada −10)
- Kredi tüketimi: kullanıcı araması = 1 OpenAlex isteği (10 kredi);
  `verify-keys` = 2 istek (20 kredi); **profil değiştirme de 10 kredi**
  (MongoDB yok → yeniden sıralama aramayı baştan yapıyor). Bellek içi önbellek
  önerildi, karar bekliyor
- Canlı: uygulama aramasında 8 kaynaktan 7'si sonuç döndürüyor (yalnız CORE
  başarısız — şablon anahtar)
- `OPENALEX_MAIL` hâlâ şablon (`example.com`); anahtarla artık gereksiz,
  ama her istekte sahte adres gönderiliyor → kaldırılmalı ya da gerçek adres

## SaaS tasarım + çok dillilik (başladı 30 Eyl 2026 gece)

Kullanıcı kararı: arayüz dili **varsayılan İngilizce**, TR/EN seçici; sonuç
dili EN/TR anahtarı ("Türkçeye çevir" kutucuğu yerine); **tüm uygulamanın**
SaaS tasarım düzeltmesi.

Aşamalar (her biri bitince işaretle):
- [x] 1. Sorunlar: üst çubuk yok, yüzen "Sistem"/geçmiş düğmeleri içeriğe
      biniyor, dev gradient başlık + yanlış yazım "Literatur", kaynak şeridi
      YANLIŞ ("Scopus 90M+" — Scopus kapalı; "7 kaynak 810M+" eski), hep
      görünen "0 kaynak seçildi", "Yazar Modu" FAB kart düğmelerini örtüyor,
      mobilde araç çubuğu dağınık ızgara
- [x] 2. i18n: `client/src/i18n/{context.js,I18nProvider.jsx,en.js,tr.js}`,
      varsayılan EN, `uiLang` localStorage, `<html lang>` + axios
      `Accept-Language`; üst çubukta `LanguageSwitcher`
- [x] 3. Sonuç dili EN/TR segmenti (`translateResults` anahtarı korunuyor)
- [x] 4. `styles/ui.css` (`ui-` önekli): topbar, btn, seg, panel, toolbar,
      menu, selbar, notice, devbanner. ⚠ `font:` kısa yazımında `inherit`
      geçersiz — kullanma (bir kez hata yapıldı, düzeltildi)
- [x] App.jsx yeniden yazıldı: AppTopBar, sayfa başlığı, ExportMenu, seçim
      çubuğu (yalnız seçim varken), FAB kaldırıldı, InfiniteTicker kaldırıldı,
      HistorySidebar mobil yüzen düğmesi kaldırıldı, DevModeBanner i18n
- [x] 6 (kısmi). Sunucu: `services/serverI18n.js` (getLang ← Accept-Language,
      varsayılan EN). Profiller, sıralama uyarıları, ikili karşılaştırma
      açıklamaları, kaydırıcı notu, /api/oa hataları dile göre. 226/226
- [~] 5. Bileşen bileşen metin + stil:
      ✅ App, AppTopBar, ExportMenu, LanguageSwitcher, DevModeBanner,
         RankingProfiles, AdvancedWeights, MethodologyModal, RankBreakdown,
         ResultCard (yeni `ui-card` iskeleti; atıf künye satırına taşındı;
         kaynak etiketleri sourceList'ten), yearDisplay
      ✅ GlobalStats (Scopus ve "Güven katmanı" rozeti kaldırıldı; kaynak
         durumu etiket satırı), HistorySidebar (ölü "Ayarlar/Yardım" kaldırıldı,
         kapalı rayda sekme paneli açıyor, mobilde seçim paneli kapatıyor,
         silme düğmesi mobilde görünür + klavye odağında görünür)
      ✅ ShareModal (açık tema, görünür bağlantı + Kopyala, Escape),
         AdminPanel (eksik durumlar eklendi: zero_results/skipped/unused —
         kapalı Scopus "Hata" görünüyordu; zeroStreaks bölümü)
      ✅ WriterPanel: tüm metinler writer.* sözlüğünde; üretim dili arayüz dilinden başlar; value kodları (akademik/orta…) değişmedi.
      ✅ LandingPage yeniden yazıldı (lp- sınıfları, styles/landing.css): doğrulanamayan iddialar (60.000+ kullanıcı, 810M+, Scopus) ve uydurma yazarlı örnekler kaldırıldı; gerçek makalelerle "Örnek" etiketli önizleme. Geliştirmede /?landing ile önizlenir.
      ✅ Aşama 7 (landing): EN 1280 + TR 390, sayfa hatası yok. i18n 437 anahtar, lint temiz.
      Araçlar: `npm run check-i18n` (anahtar eşliği + kodda kullanılan
      anahtarlar), `node scripts/merge-i18n-block.mjs <ad>` (sözlük bloğu
      ekleme; bash heredoc tırnakları bozuyor)
      Görsel kontrol (v3): masaüstü EN + mobil TR arama sonucu, sayfa hatası
      yok. Düzeltilen: mobil kart taşması (sabit max-width + grid min-width),
      EN'de puan "78%", sonuç dili anahtarına "Başlıklar" etiketi
- [ ] 6. Sunucu metinleri dile göre: profil adları/açıklamaları, ikili soru
      açıklamaları, sıralama uyarıları, /api/oa hataları
- [ ] 7. Görsel kontrol: EN + TR, 1280px + 390px, sayfa hatası yok

## M5 — Kapanış (3–4 gün)

- [ ] PubMed (MeSH, kullanıcı anahtarı alanı)
- [ ] OpenAIRE (1 saatlik token yenileme, sadece `funders`/`projects` yazar)
- [ ] `/veri-kaynaklari` atıf sayfası (12 kaynak, zorunlu ibareler)
- [ ] "TR Dizin'de taranan dergiler" profili açılır

---

## Karara bağlanan noktalar

- **Scopus:** arama akışından çıkar, özellik bayrağı arkasında sakla. *Gerekçe düzeltmesi:*
  aramayı yavaşlatmıyor (`Promise.allSettled` paralel, 401'de retry yok) — sorun
  kullanıcıya her aramada kimlik hatası uyarısı göstermesi ve gerçek arızaları maskelemesi.
- **Semantic Scholar:** yeni anahtar başvurusu yapılacak; plan anahtarsız çalışacak şekilde kalır.
- **CORE:** yeni başvuru öncesi e-posta ve panel kontrol edilecek (değer 22 karakter).
- **"Teşvik/terfi" profili:** bu adla açılmayacak. DOAJ'da olmak teşvik ölçütü *değil*
  (ölçütler SCI/SSCI/AHCI, Scopus, ESCI, TR Dizin). Ara sürüm **"TR Dizin'de taranan
  dergiler"** adıyla çıkar; DOAJ ayrı bir güven rozeti olur.
- **Sıra:** M0 → M1 → M3 → M4 → M5. M2 arka planda paralel.
- **Süre:** 29–36 iş günü (22–27 idi, belirsizliğin olduğu yere pay eklendi).

## Bu oturumda değişen dosyalar (commit edilmedi, çalışma ağacında)

| Dosya | Değişiklik |
|---|---|
| `services/sourceQuery.js` | **yeni** — kaynak başına sorgu çevirici |
| `services/sourceCanary.js` | **yeni** — üretim fonksiyonlarıyla eşik testi |
| `tests/sourceQuery.test.js` | **yeni** — 13 test |
| `tests/sourceCanary.test.js` | **yeni** — 6 test |
| `services/opencitations.js` | v2 uç + `doi:` öneki |
| `services/openalex.js` | ölü `apiKey` değişkeni kaldırıldı |
| `services/semanticscholar.js` | 401/403'te anahtarı bırakıp anahtarsız dener |
| `services/arxiv.js` | `options.fielded` — hazır `all:"..."` sorgusunu sarmalamaz |
| `services/search.js` | Scopus bayrağı, kaynak başına sorgu, `SOURCE_ZERO` |
| `services/keyHealthService.js` | canary'ye devredildi, `findDeadEnvVars()` |
| `scripts/verify-keys.mjs` | yeni durum etiketleri ve sıfır-sonuç özeti |
| `tests/keyHealthService.test.js` | üçlü durum modeline güncellendi |
| `index.js` | yapılandırılmış `queryPlan`; admin ucunda `zeroStreaks` |
| `services/retraction.js` | **yeni** — geri çekme kontrolü |
| `services/sourceZeroTracker.js` | **yeni** — ardışık sıfır sayacı |
| `services/crossref.js` | `select`'e `updated-by`, `retraction` alanı |
| `services/searchRankingService.js` | birleştirmede `retraction`, `isInDoaj`, `issnL` |
| `client/src/components/ResultCard.jsx` | geri çekme şeridi + DOAJ rozeti |
| `config/envValidation.js` | `OPENALEX_API_KEY` |
| `tests/retraction.test.js`, `doajFlag.test.js`, `sourceZeroTracker.test.js`, `envValidation.test.js` | yeni / güncellendi |
| `.env` | S2 satırı yorumlandı, `SCOPUS_ENABLED=false` eklendi (yedek alındı) |
| `.env.example` | `SCOPUS_ENABLED` + reddedilen anahtar uyarısı |

Doğrulama komutları:
```bash
cd server
npm test            # 221/221
npm run verify-keys # kaynak durumları
```

## Sonraki oturumda ilk işler

**Kod tarafı (ben):**
1. Kullanıcının üç kararına göre (aşağıda) güncellik / atıf eşiği / JUFO.
2. M4: Unpaywall + Europe PMC.
3. Clerk gelince: M3 arayüzünü tarayıcıda gözden geçir.

**Senin tarafın:**
1. `MONGODB_URI` ve `CLERK_SECRET_KEY` gerçek değerlerle.
2. **OpenAlex ücretsiz anahtarı** → `OPENALEX_API_KEY` (en yüksek getiri).
3. CORE / Scopus anahtarları sıfırdan (şablon metni girili).
4. **Karar:** JUFO/Norveç seviyeleri AHP kalite kriterine girsin mi?
5. Her `.env` değişikliğinden sonra `npm run verify-keys`.

## Doğrulanmayı bekleyenler

- DergiPark OAI-PMH base URL
- Atlas Search Lucene Türkçe analizörü + ücretsiz katman indeks sınırı
- Europe PMC limiti (~10/sn) ve `fullTextXML` uç yolu
- Resmi TR Dizin API'si var mı
- OpenAlex'in günlük bütçe modeli (ekteki doküman 1 $/gün diyor; gözlem klasik istek limiti)
- Elsevier anahtar biçimi (32 hex mi?)
- arXiv `all:` bağlaç semantiği

## M6 — Kütüphane + kaynak sepeti + dil kuralı (1 Eki 2026) — BİTTİ (lint, build, 235/235 test, tarayıcıda denendi)
- [x] USER_TOTAL_RESEARCH_LIMIT 50→20 (favori+geçmiş; favori silinmez), MAX_ANALYSES_PER_USER →20
- [x] Koleksiyonlar → tek "Kaynak sepeti" (30 makale, Clerk userId, Mongo'da kalıcı)
- [x] Sonuç kartında "Sepete ekle" + sepete uçma animasyonu; sepet sayacı n/30
- [x] WriterPanel: sepetteki makalelerle yaz; sepetten BibTeX/RIS dışa aktar
- [x] Başlık çevirisi seçeneği KALDIRILACAK; EN/TR yalnızca arayüz dili
- [x] Sorgu Türkçe ise: uluslararası kaynaklar İngilizce, EK OLARAK OpenAlex
      `language:tr` + özgün Türkçe metin (her zaman, profilden bağımsız)
- Alaka eşiği: çevrilmiş ifadede özgün Türkçe metin OR alternatifi (queryClauses);
  yoksa Türkçe başlıklar eleniyordu. "yapay zeka öğretmen tutumları" → 25'in 10'u Türkçe
- Sepet: models/Basket.js + services/basketService.js, /api/basket (GET/POST/DELETE);
  eski koleksiyonlar ilk GET'te bir kez sepete aktarılır, belgeleri SİLİNMEZ
- Yazar modu sınırı 20→30 (BASKET_LIMIT)
- Açık: skorlama metni hâlâ yalnız İngilizce → Türkçe eserler alaka puanında geride

## M7 — Kaynakça (Citation.js) + alana göre normalize atıf (1 Eki 2026) — BİTTİ
- [x] services/bibliography.js: @citation-js/core + plugin-csl (MIT), resmî CSL
      stilleri assets/csl (APA 7, IEEE, MLA 9, Chicago 18; CC BY-SA 3.0).
      DOI'li makalenin künyesi doi.org CSL-JSON (≤3,5 sn, bellekte 500 kayıt).
      Citation.js CommonJS ile yükleniyor (ESM kopyası eklentiyi görmüyor);
      0.9'da registry adı `styles`. Chicago "ahead of print" terimi boşaltıldı.
- [x] Atıf kriteri: OpenAlex FWCI log ölçek (1→0.18, 50+→1); yoksa yıllık atıf.
      Yüzdelik KULLANILMADI: ölçümde sonuçların hepsi %96-99.8 (ayırt etmiyor);
      yalnız "alanında ilk %1/%10" açıklamasında. Tekilleştirme alanları koruyor.
- 247/247 test; tarayıcıda "Neden bu sırada?" FWCI satırı doğrulandı
- Açık: npm audit'te 11 önceden var olan açık (axios, mongoose, undici, qs…)

## M8 — Bağımlılık güvenliği (1 Eki 2026) — BİTTİ
- npm audit: sunucu 11 (7 yüksek) + istemci 15 (10 yüksek) → ikisi de 0
- Sürümler (hepsi aynı ana sürüm): axios 1.15/1.16→1.20, express 4.22.1→4.22.3
  (qs 6.14→6.16; `npm audit fix` bunu çözemiyordu), express-rate-limit 8.4→8.7,
  mongoose 9.6→9.10, undici 8.2→8.11, vite 7.3.2→7.3.6
- 247/247 test, lint, build, arayüzden uçtan uca arama OK
- GitHub Dependabot/kod tarama uyarılarına bakılamadı (gh CLI yok)

## M9 — Sonuç sayfası akışı (1 Eki 2026) — BİTTİ
- "AI ile geliştir" → öneriler paneline kaydırma (açılış animasyonundan 350 ms sonra;
  animasyon sırasında başlatılan smooth scroll iptal oluyordu)
- "Sepete ekle" → "Makalene ekle / Makalen için tutuldu" (yer imi simgesi); liste
  aramalar arasında kalıyor (useBasket, değişmedi)
- Kaynak rozetleri kaldırıldı (GlobalStats: bulunan makale + AHP ile sıralanan);
  kaynak durumu sağ üst bildirim (components/Toasts.jsx): yeşil "N makale listelendi",
  sarı "X şu an yanıt vermedi" (kullanıcıya "anahtar geçersiz" gösterilmiyor)
- Alt çubuk kaldırıldı → sağ kenarda sayaçlı "Yazar modu" düğmesi (mobilde sağ alt);
  makaleler oraya uçuyor (data-basket-target="primary"), tıklayınca yazar paneli
- Tarayıcıda uçtan uca doğrulandı; lint, build, i18n temiz
