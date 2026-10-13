# Araç ve repo dizini

`CLAUDE.md`'den taşındı (2026-10-13). Parantez içindeki bölüm numaraları
(3.4, 3.7 …) `CLAUDE.md`'yi gösterir.

Bir iş emrine başlamadan önce buraya bak. Burada karşılığı olan bir şeyi
sıfırdan yazmak, iş emri açıkça gerekçelendirmediği sürece kabul edilmez.

**Lisans uyarısı:** aşağıdaki notlar yön göstericidir, hukuki görüş değildir.
Ticari aşamaya geçerken her birinin lisansı yeniden okunur. Özellikle AGPL
lisanslı projeler bir SaaS'ta kaynak açma yükümlülüğü doğurabilir.

## Kaynak istemcileri

| Paket | Kaynak | Not |
| --- | --- | --- |
| `pyalex` | OpenAlex | Ters çevrilmiş abstract'ı düz metne çeviriyor, cursor sayfalama hazır |
| `habanero` | Crossref | Tüm rotalar, bibtex eklentisi |
| `semanticscholar` | Semantic Scholar | Resmi olmayan ama bakımlı istemci |
| `arxiv.py` | arXiv | Atom XML ayrıştırmasını yapıyor; 3 sn kuralını yine sen uygula |
| `unpywall` | Unpaywall | DOI → açık erişim PDF linki |
| `PyOrcid` | ORCID | Hız limiti ve kotayı sen yöneteceksin (2.7) |
| `sickle` / `pyoai` | OAI-PMH | DergiPark ve ULAKBİM HARMAN harvest'i |

## Kaynak sağlığı

| Paket | İş |
| --- | --- |
| `rwcheck` | DOI, PMID ve `.bib` dosyalarını Retraction Watch'a karşı kontrol; veriyi yerel SQLite'a alıp 24 saatte bir tazeliyor — 3.4'teki "geri çekme önbelleğe alınmaz" kuralının hazır uygulaması |
| `retractguard` | OpenAlex-doğal geri çekme bekçisi; her bayrak kaynağını, kanıt linkini ve tarihini taşıyor |
| DOAJ API | Dergi doğrulama, yağmacı dergi kontrolü |

## Tam metin ve pasaj

| Araç | İş |
| --- | --- |
| GROBID | Bilimsel PDF → TEI XML, bölüm ayrıştırma. Üretime hazır, Docker ile |
| `docling` | Kullanıcının yüklediği karışık dosyalar (PDF, DOCX, PPTX) → yapılandırılmış markdown |
| PyMuPDF | Pasajın sayfadaki konumunu işaretlemek için |
| Semantic Scholar snippet search | Hazır pasaj altyapısı — kendi indeksini kurmadan başla |

`marker`: lisansı ticari kullanımda kısıtlı olabilir, kullanmadan önce oku.
GROBID + docling zaten yetiyor.

## Doğrulama çekirdeği

| Kaynak | İş |
| --- | --- |
| `allenai/scifact` | Bilimsel iddia doğrulamanın referans veri kümesi — E2'yi buna karşı kalibre et |
| `allenai/scicite` | Atıf niyeti sınıflandırması (`background` / `method` / `result`), her örnekte bölüm adı var. Bölüm uygunluğunu promptla değil bununla çöz |
| `GooTec/citation-guard` | Atıf sadakati ölçüm protokolü, MIT, tek GPU veya CPU |
| DeBERTa tabanlı NLI modelleri | Doğrulama öncesi ucuz ön eleme (3.7) |
| `Beverly621/ClaimTrellis` | İddia → kaynak → pasaj → yargı → denetim izi akışı; mimarimizin en yakın akrabası, okumaya değer |

## LLM altyapısı

| Paket | İş |
| --- | --- |
| `litellm` | Çok sağlayıcılı tek arayüz, yedekleme, harcama takibi — 3.7'deki "tek sağlayıcıya bağımlı olma" kuralının altyapısı |
| `instructor` | Pydantic ile şema zorlama ve otomatik yeniden deneme — 3.8'in dördüncü katmanı |
| `langfuse` | İzleme, maliyet, prompt sürüm yönetimi — 3.4 ve 3.9'un altyapısı |
| `promptfoo` | Prompt regresyon testi — Bölüm 4.6 bununla otomatikleşir |

`GPTCache` (anlamsal önbellek): **doğrulama adımında kullanılmaz** (3.4).
Sorgu genişletmede kullanılabilir.

## Çıktı ve dışa aktarma

| Araç | İş |
| --- | --- |
| `citation-style-language/styles` | 10.000'i aşkın hazır atıf stili — APA, IEEE, Vancouver, dergi bazlı. Atıf stilini elle yazma |
| `citeproc-js` | CSL stilleriyle atıf ve kaynakça üretimi, tarayıcıda |
| `citation-js` | BibTeX, RIS, CSL-JSON dönüşümü |
| `pandoc` | Markdown → DOCX, PDF, LaTeX |
| `zotero/translation-server` | URL veya DOI'den referans çıkarma |

## Türkçe katman

| Kaynak | İş |
| --- | --- |
| `q1-crafter-mcp` | TR Dizin, DergiPark (OAI-PMH) ve YÖK Tez Merkezi'ni destekleyen MCP sunucusu; DOI + bulanık başlık ile iki aşamalı tekilleştirme, Türkçe karakterli APA 7. Tekilleştirme mantığını incele |
| BGE-M3 / multilingual-e5 | Türkçe–İngilizce çapraz pasaj araması için gömme; A/B karşılaştır |
| `stefan-it/turkish-bert` | Türkçe küçük görevler için ince ayar tabanı |

## Arayüz

| Paket | İş |
| --- | --- |
| TipTap (ProseMirror) | Cümleye `claim_id` çapası gömmek için özel düğüm tanımlanabilen düzenleyici |
| React Flow (`xyflow`) | Kavram haritası, düğüm-kenar grafiği |
| `pingouin` / `statsmodels` | Analiz paneli motoru, APA biçiminde çıktı |
| `pyodide` | Analizi tarayıcıda çalıştırma — kullanıcı verisi sunucuya hiç gitmez |

`jamovi` / `JASP`: AGPL. Arayüz fikrine bakmak serbest, kod almadan önce
hukuki görüş al.
