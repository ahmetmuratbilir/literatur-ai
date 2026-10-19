# WO-027 — Yapay zekâ geçidi: tek kapı, kullanıcının anahtarı her çağrıda, Claude/Kimi/OpenAI

| Alan | Değer |
| --- | --- |
| Durum | Hazır (19.10.2026) — kullanıcı kararı (geri bildirim madde 15) |
| Kapsam | Sunucu (yapay zekâ çağrıları) + istemci ayar ekranı |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2 oturum |
| Ön koşul | WO-023 (BYOK) |
| Yol haritası aşaması | P1 |
| Dal | `wo-027-ai-gecit` |
| Kaynak | BYOK denetim raporu (19.10.2026, ajan); sağlayıcı belgeleri 2026-10-19 okundu |

## Problem (denetimde bulunan, dosya:satır raporda)
- Eski yazar yolu (`aiService.js`, `deepseek.js`) ve gömme (`embeddingService.js`) kullanıcının anahtarını değil platform anahtarını kullanıyor; kullanım kaydı yanlışlıkla "user" yazıyor.
- `/api/consensus` girişsiz ve hız sınırsız: herkes platform bütçesini harcayabilir; istemci yetki başlığı göndermiyor.
- Ara katman veritabanı yoksa / anahtar çözülemezse sessizce platform anahtarına düşüyor (2.8).
- 402 (bakiye) ve 404 (model) kullanıcıya söylenmiyor; genel 502.
- Sağlayıcı listesi 5 yerde tekrarlı; yalnız OpenAI-uyumlu biçim.

## Kapsam
### Dahil
1. `server/config/aiProviders.js`: tek sağlayıcı kaydı (id, ad, uyum: openai | anthropic, adres, doğrulama ucu, hızlı/güçlü model, JSON desteği, örnekleme kuralı, düşünmeyi kapatma, token parametresi). İstemci listeyi sunucudan alır.
2. `server/services/aiGateway.js`: `chatJson`, `chatStream`, `embed`. Kimlik bilgisi YALNIZ `aiContext`'ten; desteklenmeyen parametreyi düşürür, kullanım kaydını gerçek anahtar kaynağıyla yazar (3.9). Anthropic için yerel Messages API (OpenAI uyumlu uçta JSON ve sıcaklık çalışmıyor).
3. Bütün çağrı yerleri geçide: `llm.js`, `utils/translation.js`, `citedSentence.js`, `languageEdit.js`, `deepseek.js`, `aiService.js`, `embeddingService.js`.
4. Gömme kararı: kullanıcı anahtarı gömme sunmayan sağlayıcıdaysa (Anthropic, DeepSeek, Groq, Kimi) yazarın RAG'ı BYOK altında çalışmaz ve arayüz bunu söyler (yazar paneli zaten kapalı).
5. Sessiz düşme kalkar: anahtar okunamazsa `AiKeyError`, kullanıcıya "Anahtarın şu an okunamıyor" — platform anahtarına sormadan geçilmez. 402 → bakiye, 404 → model durumu, istemci bildirimi.
6. `/api/consensus`: giriş zorunlu + hız sınırı; istemci yetki başlığı gönderir.
7. Yeni sağlayıcılar: Anthropic (Claude), Moonshot (Kimi), OpenAI; isteğe bağlı OpenRouter. Model kimlikleri canlı `/models` çağrısıyla sabitlenir.
8. Zorlama testi `aiGatewayOnly.test.js`: geçit dışında sağlayıcı adresi, `chat/completions`, `*_API_KEY` okuması bulunursa düşer; her giriş noktası kullanıcı bağlamında çalıştırılıp istek başlığı denetlenir.

### Hariç
- Sağlayıcı başına fiyatlandırma/kota arayüzü; ücretli plan.
- PR3 doğrulamasının kullanıcı modeline göre kalite ölçümü (E2 kümesi yok — 4.1; sonuç kaydına sağlayıcı+model yazılır, o kadar).

## Dokunulabilecek dosyalar
- yeni: `server/config/aiProviders.js`, `server/services/aiGateway.js`, `server/tests/aiGatewayOnly.test.js`
- `server/config/aiModels.js`, `server/models/AiConnection.js` (enum'a ekleme — veri göçü yok), `server/services/aiConnectionService.js`, `aiContext.js`, `routes/aiConnections.js`, `llm.js`, `utils/translation.js`, `citedSentence.js`, `languageEdit.js`, `deepseek.js`, `aiService.js`, `embeddingService.js`, `utils/aiUsage.js`, `index.js` (consensus, yazar SSE durumu)
- `client/src/components/settings/AiConnections.jsx`, `ConsensusSnapshot.jsx`, `App.jsx` (yeni durum bildirimleri), i18n tr/en
- mevcut testler: `aiConnections`, `citedSentence*`, `languageEdit`, `queryAnalysis`
- `CLAUDE.md` (3.7/3.12 notu), README, bu dosya

## Kabul kriterleri
- [ ] Zorlama testi geçer; geçit dışında sağlayıcı çağrısı yok.
- [ ] Kullanıcı bağlamında her giriş noktası `Bearer KULLANICI` (Anthropic: `x-api-key`) gönderir; platform anahtarı görülmez.
- [ ] Anahtar okunamazsa istek platforma düşmez; kullanıcıya söylenir.
- [ ] `/api/consensus` girişsiz 401, sınır aşımında 429.
- [ ] Anthropic/Kimi/OpenAI anahtarı kaydedilip doğrulanabilir; bir JSON görevi (sorgu analizi) her biriyle çalışır (canlı deneme Ahmet'in anahtarıyla, isteğe bağlı).
- [ ] Sunucu, istemci birim, lint, e2e geçer.
- [ ] **Doğrulama ajanı** (tek ajan, ölçüm türü): canlı/sahte sunucuyla her giriş noktasını çalıştırıp anahtar kaynağını raporlar; bulgu 0.

## Geri alma
Commit grubu `git revert`. `BYOK_ENABLED=false` iken geçit yalnız platform anahtarıyla çalışır (bugünkü davranış).

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Sağlayıcı model kimlikleri değişir | Orta | 404 | Kimlik ortam değişkeniyle değişir; 404 kullanıcıya "model" durumu |
| Düşünen modeller küçük token bütçesinde boş döner | Orta | Boş JSON | Geçit düşünme payı ekler; boş yanıt yeniden denenmez, söylenir |
| Sağlayıcı şartları üçüncü taraf uygulamada anahtar kullanımını kısıtlar | Düşük | Hukuki | Her sağlayıcının şartı `docs/sources.md` benzeri notla kaydedilir |

## Onay gereken noktalar
- Canlı sağlayıcı denemesi Ahmet'in kendi anahtarlarıyla (anahtar sohbete yazılmaz, `server/.env`'e kendisi koyar).

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
