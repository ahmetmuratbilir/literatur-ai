# Kaynak durum matrisi

CLAUDE.md 2.7'nin kaydı. Her kaynak için dört durum ayrı izlenir; dördü birden
olmadan kaynak canlıya çıkmaz. Buradaki lisans notları hukuki görüş değildir.

| Durum | Anlamı |
| --- | --- |
| `VERIFIED` | Güncel dokümantasyon ve kullanım koşulları okundu, tarih kaydedildi |
| `IMPLEMENTED` | Entegrasyon kodda mevcut |
| `TESTED` | Gerçek isteklerle çalıştığı doğrulandı |
| `APPROVED_FOR_PRODUCTION` | Lisans, gösterim ve ticari kullanım koşulları bizim kullanım biçimimize uygun |

## Özet

| Kaynak | VERIFIED | IMPLEMENTED | TESTED | APPROVED_FOR_PRODUCTION |
| --- | --- | --- | --- | --- |
| ORCID (Public API) | ✓ 2026-10-09 / 2026-10-10 | ✓ (yalnızca zenginleştirme) | ✓ 2026-10-10 | **Koşullu** — gelir yokken evet; gelir başladığı gün hayır |
| OpenAlex | ✓ 2026-10-19 | ✓ `services/openalex.js` | ✓ 2026-10-19 (8/8, 1,1–4,5 sn) | **Evet** (veri CC0). Koşul: kullanım başına ücretli; anahtarsız ~100 arama/gün, ücretsiz anahtarla ~1.000 — Render'da `OPENALEX_API_KEY` doğrulanmalı |
| Crossref (+ geri çekme) | ✓ 2026-10-19 | ✓ `services/crossref.js`, `retraction.js` | Kısmen (7/8; 1 zaman aşımı) | **Koşullu** — metadata serbest; bazı özetler yayıncı/yazar telifinde |
| Semantic Scholar | ✓ 2026-10-19 | ✓ `services/semanticscholar.js` | ✗ anahtarsız ortak havuz 429 (6/6 arama) | **Belirsiz — yazılı onay (AI2)**: API lisansında ticari madde yok; pasaj gösterimi sorulmalı |
| Europe PMC | ✓ 2026-10-19 | ✓ | ✓ (8/8) | **Koşullu** — içerik telifli; açık erişim alt kümesi makale lisansına bağlı |
| PubMed (E-utilities) | ✓ 2026-10-19 | ✓ | ✓ (8/8) | **Koşullu** — NLM özette telif iddia etmez, yayıncı edebilir; "Courtesy of NLM" ibaresi; `tool`/`email` kaydı |
| DOAJ | ✓ 2026-10-19 | ✓ | ✓ (8/8) | **Evet** — metadata CC0 (ad korumalı) |
| OpenAIRE Graph | ✓ 2026-10-19 | ✓ `services/openaire.js` | ✓ (8/8; 1 yavaş) | **Evet** — CC-BY, "OpenAIRE" atfıyla |
| DataCite | ✓ 2026-10-19 | ✓ | ✓ (sıfır sonuçlar tasarım gereği) | **Evet** — CC0 |
| arXiv | ✓ 2026-10-19 | ✓ (canlı sorgu) | Kararsız → zaman aşımı yeniden deneme hatası düzeltildi (887974d) | **Evet** (metadata ve özet CC0; PDF barındırılmaz, özet sayfasına bağlanır). **Çelişki:** CLAUDE.md 2.7 arXiv'i Kademe 2'de (yalnız hasat) sayıyor, kod canlı sorguluyor; arXiv şartları canlı kullanıma 3 sn'de 1 istekle izin veriyor — tüzük ya da kod güncellenmeli (Ahmet kararı) |
| CORE | ✓ 2026-10-19 | ✓ (canlı sorgu) | ✗ yerel anahtar şablon; anahtarlı da 7–30 sn (6,5 sn sınırı) | **Hayır — yazılı izin/lisans** ("para kazanabilecek ürün" için lisans). **Çelişki:** 2.7'de Kademe 2, kod canlı sorguluyor — canlıdan çıkarma kararı Ahmet'te |
| Unpaywall | ✓ 2026-10-19 (kısmen) | ✓ | ✓ (4/4) | **Belirsiz** — 2020 şartları yeniden dağıtımı kısıtlıyordu; Unpaywall artık OpenAlex verisi: OpenAlex `open_access` alanına geçmek önerilir |
| OpenCitations | ✓ 2026-10-19 | ✓ (zenginleştirme) | Kararsız (1 bütçe aşımı, sessiz) | **Evet** — CC0 |
| Retraction Watch (Crossref yoluyla) | ✓ 2026-10-19 | ✓ (Crossref `update-type`) | ✓ | **Belirsiz — yazılı onay**: "lisanssız yeniden kullanım" deniyor, ticari kullanım yazılı değil |
| Scopus / Elsevier, WoS, Dimensions, Lens | ✓ 2026-10-19 (Elsevier, Dimensions, Lens) | Scopus kodu var, kapalı (`SCOPUS_ENABLED=false`) | — | **Hayır** — Kademe 3; yazılı onay olmadan açılmaz |
| DergiPark (OAI-PMH) | ✓ 2026-10-19 | ✗ | Uç canlı denendi (100 kayıt, TR+EN özet) | **Yazılı izin (ULAKBİM)** — yeniden kullanım şartı yayımlanmamış |
| TR Dizin | ✓ 2026-10-19 | ✗ | Arama API'si canlı denendi | **Yazılı izin (ULAKBİM)** |
| YÖK Tez | ✓ 2026-10-19 | ✗ | — | **Yazılı izin**; resmi API yok, kazıma yapılmaz |
| Google Scholar | ✓ 2026-10-19 | ✗ | — | **Hayır** — robots.txt `/scholar`'ı yasaklıyor; kazıma kabul edilemez |

Kanıt: her kaynağın resmi şartlar/belge sayfası 2026-10-19'da okundu (ajan
raporu; bağlantılar aşağıdaki "Kaynak bağlantıları" bölümünde). Canlı ölçüm:
88 kaynak çağrısı + 6 gerçek arama, aynı gün. Bu satırlar hukuki görüş değildir.

### Yazılı izin istenecekler

ULAKBİM (DergiPark, TR Dizin), CORE, AI2 (Semantic Scholar pasaj gösterimi),
Crossref (Retraction Watch ticari kullanım). Taslakları Ahmet'in onayıyla yazılır.

### Kaynak bağlantıları (okundu 2026-10-19)

| Kaynak | Şartlar / belge |
| --- | --- |
| OpenAlex | help.openalex.org/access/pricing/ · /how-to-use-the-api/rate-limits-and-authentication |
| Crossref | crossref.org/documentation/retrieve-metadata/rest-api/ |
| Retraction Watch | crossref.org/documentation/retrieve-metadata/retraction-watch/ |
| Semantic Scholar | semanticscholar.org/product/api/license |
| Europe PMC | europepmc.org/Copyright |
| PubMed / NLM | nlm.nih.gov/databases/download/terms_and_conditions.html |
| DOAJ | doaj.org/terms/ |
| CORE | core.ac.uk/terms · core.ac.uk/services/api |
| OpenAIRE | graph.openaire.eu/docs/apis/terms · /docs/license |
| DataCite | support.datacite.org/docs/datacite-data-file-use-policy |
| arXiv | info.arxiv.org/help/api/tou.html |
| Unpaywall | help.openalex.org/access/unpaywall.md |
| OpenCitations | opencitations.net/about |
| Dimensions | dimensions.ai/scientometric-research/ |
| Lens | about.lens.org/policies/ |
| Elsevier | elsevier.com/legal/elsevier-website-terms-and-conditions |
| DergiPark | dergipark.org.tr/api/public/oai/?verb=Identify |
| TR Dizin | trdizin.gov.tr/kullanim-sartlari/ · development.trdizin.gov.tr |
| Google Scholar | scholar.google.com/robots.txt |

---

## ORCID (Public API)

**Kullanım biçimimiz:** Yazar panelinde yalnızca zenginleştirme (CLAUDE.md
3.10). Aday listesini OpenAlex üretir; ORCID, listede zaten olan ve ORCID'i
bilinen kişilerin kurum geçmişini tek istekte getirir. ORCID'den kişi
eklenmez, yayın listesi çekilmez.

| Alan | Değer | Kanıt |
| --- | --- | --- |
| Erişim | `https://pub.orcid.org/v3.0/expanded-search/` — anahtarsız çalışıyor; `/read-public` token'ı isteğe bağlı (`ORCID_ACCESS_TOKEN`) | Gerçek istek, 2026-10-10 |
| Ticari kullanım | Yasak: "you may not charge any re-use fees for the Public APIs" ve "you may not make use of the public APIs in connection with any revenue-generating product or service" | [Public APIs Terms of Service](https://info.orcid.org/public-client-terms-of-service/), okundu 2026-10-09 |
| Hız limiti | 12 istek/sn, 40'a kadar burst; burst aşılırsa 503 | [What are the API limits?](https://info.orcid.org/ufaqs/what-are-the-api-limits/), okundu 2026-10-10 |
| Günlük kota | Kayıtsız: 25.000 okuma/gün, IP başına. Kayıtlı (Public API client): 100.000 okuma/gün, Client ID başına. Aşılırsa o süre içinde istek engellenir | Aynı sayfa, 2026-10-10 |
| Kimlik bilgisi | Kişi başına tek set; paylaşılamaz, devredilemez | CLAUDE.md 2.7 (bu satır tarafımdan ayrıca doğrulanmadı) |
| Atıf yükümlülüğü | Doğrulanmadı | — |
| Kod | `server/services/orcid.js`, `GET /api/authors/orcid` (`server/index.js`), bayrak `ORCID_ENABLED` (varsayılan `false`) | — |
| Testler | `server/tests/orcidAuthors.test.js`, `server/tests/authorsEndpoint.test.js` (sahte cevaplarla) | — |
| Gerçek istek ölçümü | Zenginleştirme 7 ORCID için 0,17–0,32 sn (3 deneme); 7 kaydın 3'ünde kurum bilgisi var | 2026-10-10, yerel sunucu |
| Hata davranışı | ORCID düşerse uç `{ enabled: true, affiliations: {}, failed: true }` döner, liste etkilenmez; kaynak kesici (`guarded`, 4,5 sn) | `authorsEndpoint.test.js` |

### APPROVED_FOR_PRODUCTION koşulu

| Koşul | Durum |
| --- | --- |
| Bugün kullanılabilir mi | Evet — ürün gelir üretmiyor (tanıtım ve prototip aşaması) |
| Abonelik, ücretli paket veya gelir başlarsa | **O gün kapatılır** (`ORCID_ENABLED=false`) |
| Yeniden açma yolu | ORCID üyeliği veya yazılı izin |

---

## Ticarileşme kontrol listesi

Fiyatlandırma sayfası yayına girmeden ve ilk ücretli işlem alınmadan **önce**
hepsi tamamlanmış olmalı. Bu bir hatırlatma değil, çıkış koşuludur.

- [ ] Canlı ortamda (Render) `ORCID_ENABLED=false` yapıldı ve `/api/authors/orcid` uç noktasının `{"enabled":false}` döndüğü doğrulandı
- [ ] ORCID'i yeniden açmak için üyelik veya yazılı izin alındıysa, belgesi bu dosyaya bağlandı
- [ ] Bu tablodaki diğer kaynakların ticari kullanım koşulları yeniden okundu
