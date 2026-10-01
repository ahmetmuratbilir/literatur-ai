# Makale Çözümleyici (Paper Resolver)

Kullanıcının elindeki ipucundan (DOI, URL, kaynakça satırı, "yazar + yıl + konu")
doğru makaleyi bulur, doğrular ve kanonik kaydı döndürür. Arayüzde
**"Kaynakçanı doğrula"** sekmesi bunu kullanır: her satır için doğru APA 7 satırı
ve farklar (soyad yazımı, eksik ortak yazar, eksik cilt/sayı/sayfa) gösterilir.

Eşleşme bulunamazsa `not_found` döner. DOI ya da URL **asla uydurulmaz**.

## Kod

| Dosya | İş |
|---|---|
| `server/services/resolver/parse.js` | Katman 0: DOI, arXiv, PMID/PMCID, ISBN, ScienceDirect PII, URL tanıma; APA/IEEE/serbest metin ayrıştırma |
| `server/services/resolver/validate.js` | Türkçe katlama, `token_set_ratio` (rapidfuzz karşılığı), skor, karar, fark raporu |
| `server/services/resolver/sources.js` | Crossref, doi.org, OpenAlex, Semantic Scholar, Europe PMC, arXiv, sayfa meta etiketleri, Wayback |
| `server/services/resolver/ratelimit.js` | Kaynak başına aralık + eşzamanlılık; 429'da `Retry-After` / üstel geri çekilme |
| `server/services/resolver/cache.js` | Bellek LRU + MongoDB `ResolverCache` (TTL) |
| `server/services/resolver/pipeline.js` | Şelale, zenginleştirme, çıktı |
| `client/src/components/CitationChecker.jsx` | "Kaynakçanı doğrula" ekranı |

## Uç noktalar (giriş gerekli, dakikada 20 istek)

- `POST /api/resolve` — `{ "input": "..." }` → tek sonuç
- `POST /api/resolve/batch` — `{ "lines": ["...", ...] }` (en fazla 50) → `{ results, summary, cost_usd }`

BibTeX/RIS dışa aktarma istemcide (`client/src/utils/citationExport.js`, "Makalen için" listesi).

## Şelale

1. **Önbellek** — aynı girdi ikinci kez gelirse sıfır dış çağrı.
2. **Katman 0 (kimlik)** — DOI → Crossref, yoksa doi.org (DataCite). arXiv → DataCite DOI'si
   (`10.48550/arXiv.ID`), yoksa arXiv API. PMID/PMCID → Europe PMC. ScienceDirect PII →
   Crossref `alternative-id`. URL → sayfadaki `citation_*`, `dc.*`, `prism.*`, JSON-LD;
   ulaşılamazsa Wayback Machine. **Arama yapılmaz.**
3. **Katman 1 (arama)** — Crossref `query.bibliographic` (ücretsiz) → Semantic Scholar
   `search/match` + Europe PMC (girdi biyomedikal görünüyorsa) → OpenAlex araması
   (ücretli, son çare). Türkçe girdi bulunamazsa DeepSeek ile İngilizceye çevrilip bir
   kez daha aranır; çeviriyle bulunan sonuç en fazla "adaylar" olur. Çeviri yalnızca
   sorgu içindir, sonuç her zaman indeksten gelir.
4. **Kanonikleştirme** — bulunan kaydın künyesi DOI üzerinden Crossref'ten alınır
   (OpenAlex soyadı ayırmıyor). Crossref'te ada yapışmış soyad eki ("Sebastiano Di" +
   "Luozzo") soyada taşınır.
5. **Zenginleştirme** — OpenAlex tekil kayıt (DOAJ, açık erişim, OpenAlex kimliği),
   Unpaywall (en fazla 3 sn bekler), geri çekilme (Crossref `updated-by`, Retraction Watch dahil).

## Doğrulama

Skor = başlık 0,60 + ilk yazar 0,25 + yıl 0,15 (girdide olmayan alanın ağırlığı
diğerlerine dağıtılır). ≥ 0,85 bulundu · 0,65–0,85 adaylar · altı bulunamadı.

Ek kurallar (canlı testlerde ortaya çıktı):
- Çok kısa girdi (≤ 2 anlamlı sözcük) tek başına "bulundu" olamaz.
- **Kapsam:** aday başlık girdinin yarısından azını karşılıyorsa benzerlik sınırlanır
  (uydurma bir başlık, 2 sözcüklü gerçek bir başlıkla %100 eşleşiyordu).
- Aday olmak için başlık benzerliği ≥ 0,6 (yalnızca yıl tutan ilgisiz makale elenir).
- Serbest metinde yazar ve yıl yoksa "bulundu" için 0,95; ilk iki aday 0,05'ten yakınsa belirsiz.
- Crossref hakem raporu kayıtları ("Author response for…") elenir.

## Ortam değişkenleri

Yeni değişken yok; mevcutlar kullanılıyor: `CONTACT_EMAIL` / `OPENALEX_MAIL` (Crossref
polite havuzu), `OPENALEX_API_KEY`, `SEMANTIC_SCHOLAR_API_KEY`, `UNPAYWALL_EMAIL`,
DeepSeek anahtarı (yalnız Türkçe girdi çevirisi).

## Maliyet ve gecikme (canlı ölçüm, 1 Eki 2026)

| Girdi | Süre | Maliyet |
|---|---|---|
| DOI / URL'de DOI | 0,5–1,3 sn | 0 $ |
| Kaynakça satırı (Crossref bulur) | 1,3–3,5 sn | 0 $ |
| Türkçe belirsiz girdi (+ çeviri) | ~8 sn | 0,002 $ |
| Bulunamayan girdi | ~9 sn | 0,002 $ |
| Önbellekten | ~0 sn | 0 $ |

OpenAlex günlük bütçesi 1 $ (10.000 kredi) ve ana aramayla ortak: arama 0,001 $,
tekil kayıt 0 $. Bu yüzden OpenAlex araması şelalenin son basamağı.

## Testler

- Birim (ağ yok): `node --test tests/resolverParse.test.js tests/resolverValidate.test.js tests/resolverPipeline.test.js`
- Canlı kabul: `node scripts/resolver-live.mjs` (11/11). #8'in GitHub/Hugging Face beklentisi
  ilk sürümün dışında; makale bulunuyor.

## Kapsam dışı (ilk sürüm)

Zotero translation-server (ScienceDirect PII Crossref'te çözüldüğü için gerek kalmadı),
GitHub/Hugging Face, ücretli web araması (Serper/Brave/Exa), GDELT haberleri,
DergiPark yerel dizini (OAI-PMH toplama ikinci MongoDB gelince eklenecek).

## Lisans ve kullanım notları

- PDF saklanmaz ve sunulmaz; yalnızca yasal kaynağa (yayıncı, Unpaywall, arXiv) bağlantı verilir.
- Semantic Scholar ve arXiv verisi kullanıldığında arayüzde kaynak gösterilmeli.
- DergiPark sitesinin `/search` sayfası kazınmaz; veri yalnızca OAI-PMH ile alınır.
