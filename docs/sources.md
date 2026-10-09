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

Diğer kaynaklar (OpenAlex, Crossref, Semantic Scholar, Europe PMC, PubMed,
Unpaywall, DOAJ, OpenCitations, arXiv, CORE, OpenAIRE, Scopus …) henüz bu
tabloya girmedi. Durumları WO-001 denetiminde kanıtla belirlenip eklenecek;
o zamana kadar hiçbiri `VERIFIED` sayılmaz.

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
