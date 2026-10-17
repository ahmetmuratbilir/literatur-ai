# WO-023 — Yapay zekâ bağlantıları: kullanıcının kendi anahtarı

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (17.10.2026, `wo-023-yz-baglantilari`; kullanıcı onayı: MVP kapsamı, koleksiyon ve gizli değişken dahil) |
| Kapsam | Çapraz (sunucu: şifreli saklama, istek bazında anahtar; istemci: ayarlar ekranı) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2 oturum |
| Ön koşul | WO-017 (kabuk: Ayarlar yeri) |
| Yol haritası aşaması | P1 — `docs/design/urunlestirme-plani.md` adım C |
| Dal | `wo-023-yz-baglantilari`, WO-017 ucundan |

## Problem
Bütün model çağrıları Literatür AI'nın anahtarlarıyla yapılıyor
(`server/config/aiModels.js`: DeepSeek, Gemini, Groq; anahtarlar ortam
değişkeninden). Kendi anahtarı olan kullanıcı (araştırma bütçesi, kurum
hesabı) onu kullanamıyor.

## Neden şimdi
Kullanıcı kararı (17.10.2026): "default biz olacağız ama insanlar kendi
anahtarlarıyla da kullanabilsin". Ödeme sistemi olmadan da ürünü
sürdürülebilir kılar: yoğun kullanıcı kendi maliyetini taşır.

## Kapsam
### Dahil
- **Ayarlar › Yapay zekâ bağlantıları** ekranı: "Literatür AI (varsayılan)"
  satırı; sağlayıcı başına "Anahtar ekle" (DeepSeek, Gemini, Groq);
  "Bağlantıyı dene"; "Kaldır"; etkin bağlantı seçimi; anahtarın yalnız son 4
  hanesi görünür.
- **Sunucu saklama:** yeni koleksiyon `AiConnection` {userId, provider,
  cipher, iv, tag, last4, createdAt, lastCheckedAt, lastStatus}. AES-256-GCM;
  ana anahtar `KEY_ENCRYPTION_KEY` ortam değişkeni (yoksa özellik kapalı,
  başlangıçta uyarı).
- **İstek bazında anahtar:** model çağıran uçlar (`llm.js`, `aiService.js`,
  dil düzeltme, atıflı cümle …) kullanıcının etkin bağlantısını sağlayıcı
  sırasının başına koyar. Kullanıcı anahtarı hata verirse **sessizce bizim
  anahtara geçilmez**: yanıt `byok_failed` + neden; arayüz "Anahtarın çalışmadı
  (kota/geçersiz) — varsayılanla dene" düğmesi.
- **Bağlantı denemesi:** en küçük çağrı (model listesi ya da 1 token);
  kullanıcı başına dakikada 5 ile sınırlı.
- **Ölçümleme** (3.9): `logAiUsage` kaydına `keySource: 'user' | 'platform'`;
  anahtar hiçbir logda yok (birim test).
- **Bilgilendirme metni:** kendi anahtarınla gönderilen metin o sağlayıcının
  şartlarına tabidir.

### Hariç
- OpenAI, Anthropic, OpenRouter bağdaştırıcıları (faz 2; mimari hazır olur).
- Ödeme/kredi ilişkisi (ertelendi).
- Kurum düzeyinde ortak anahtar.

## Dokunulabilecek dosyalar
- `server/models/AiConnection.js` (yeni), `server/services/keyVault.js` (yeni; şifreleme)
- `server/routes/aiConnections.js` (yeni) ve `server/index.js` (yalnız rota kaydı)
- `server/config/aiModels.js`, `server/services/llm.js`, `server/services/aiService.js`, `server/services/deepseek.js`, model çağıran diğer servisler (yalnız anahtar kaynağını parametre almak için)
- `server/utils/aiUsage.js` (`keySource` alanı), `server/config/envValidation.js` (`KEY_ENCRYPTION_KEY`)
- `server/tests/keyVault.test.js`, `server/tests/aiConnections.test.js` (yeni)
- `client/src/components/settings/AiConnections.jsx` (yeni), kabuktaki Ayarlar bağlantısı
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/e2e/ai-connections.spec.js` (yeni), `client/e2e/kabul.spec.js` (yolculuğa bir adım)
- `server/.env.example`, `CLAUDE.md` 3.12 bayrak tablosu, `docs/work-orders/README.md`, bu dosya

## Yaklaşım
- Şifreleme Node `crypto` (yeni bağımlılık yok). Her kayıtta rastgele IV;
  doğrulama etiketi saklanır. Ana anahtar değişirse eski kayıtlar
  çözülemez → kullanıcıya "anahtarını yeniden gir" (veri kaybı değil).
- Sağlayıcı sırası bugünkü gibi yapılandırmadan; kullanıcının bağlantısı
  yalnız başa eklenir. Çağıran kod anahtarı görmez, `resolveChatProvider`
  istek bağlamından alır.
- Arayüz uç noktası anahtarı asla döndürmez: GET yalnız {provider, last4,
  lastStatus, lastCheckedAt}.

## Kabul kriterleri
- [ ] Anahtar kaydedilir, yalnız son 4 hane döner; GET yanıtında, loglarda ve hata mesajlarında anahtar yok (birim test, metin taraması).
- [ ] Şifreli kayıt ana anahtar olmadan çözülemez; yanlış etiket reddedilir (birim test).
- [ ] Etkin bağlantıyla yapılan çağrı kullanıcının anahtarını kullanır; `logAiUsage` kaydında `keySource: 'user'` (birim test, sahte sağlayıcı).
- [ ] Kullanıcı anahtarı 401/429 verince bizim anahtara geçilmez; yanıt `byok_failed` (birim test).
- [ ] "Bağlantıyı dene" geçerli/geçersiz anahtarı doğru gösterir; dakikada 5 sınırı (birim + e2e sahte).
- [ ] Bağlantı yokken her şey bugünkü gibi çalışır (mevcut testlerin tamamı geçiyor).
- [ ] `KEY_ENCRYPTION_KEY` yoksa ekran "bu sunucuda kapalı" der, uygulama çökmez.
- [ ] `npm run kontrol` geçiyor; Ahmet kendi anahtarıyla elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Şifreleme | `server: npm test` (`keyVault.test.js`) | Gidiş-dönüş, bozuk etiket reddi |
| Uçlar | `server: npm test` (`aiConnections.test.js`) | Anahtar sızmıyor, sınır, geri düşüş yok |
| Arayüz | `npx playwright test ai-connections.spec.js` | Ekle, dene, kaldır, hata yolu |
| Elle | Kendi DeepSeek/Gemini anahtarınla "AI ile geliştir" | Çalışır; Render loglarında `keySource: user` |

## Ölçüm
Kendi anahtarıyla yapılan çağrı oranı (`keySource`), izlenir. Kalite
metriği yok (aynı modeller).

## Geri alma
`BYOK_ENABLED` sunucu bayrağı (varsayılan `false`; CLAUDE.md 3.12'ye
eklenir). Kapalıyken ekran görünmez, kayıtlı bağlantılar kullanılmaz ama
silinmez. `AiConnection` koleksiyonu ayrı; diğer veriye dokunmaz.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Anahtar sızıntısı (log, hata mesajı) | Düşük | Çok yüksek | Birim test metin taraması; anahtar yalnız `keyVault` içinde açık |
| Ana anahtar kaybı | Düşük | Kullanıcılar anahtarı yeniden girer | Render gizli değişkeni; belgelenir |
| Kullanıcı zayıf model seçer | Orta | Doğrulama kalitesi düşer | 3.7 uyarısı |

## Onay gereken noktalar
- Yeni koleksiyon `AiConnection` (tüzük kural 6: şema).
- Render'da `KEY_ENCRYPTION_KEY` gizli değişkeninin eklenmesi (dağıtım).

## Bitiş raporu
- **Değişen dosyalar:** sunucu — yeni `services/aiContext.js`,
  `services/keyVault.js`, `services/aiConnectionService.js`,
  `models/AiConnection.js`, `routes/aiConnections.js`,
  `tests/keyVault.test.js`, `tests/aiConnections.test.js`; değişen
  `config/aiModels.js`, `services/llm.js`, `services/citedSentence.js`,
  `services/languageEdit.js`, `utils/translation.js`, `utils/aiUsage.js`,
  `index.js`, `.env.example`. İstemci — yeni
  `components/settings/AiConnections.jsx`, `e2e/ai-connections.spec.js`;
  değişen `App.jsx`, `HistorySidebar.jsx`, `styles/ui.css`, `i18n/tr.js`,
  `i18n/en.js`. `CLAUDE.md` 3.12 tablosu.
- **Teknik kararlar:**
  - Anahtar istek boyunca `AsyncLocalStorage` bağlamında (`aiContext.js`);
    model çağıran kod değişmedi, anahtarı `aiModels.js` tek yerden verir
    (`keyFor`). Bağlantı varken yalnız kullanıcının sağlayıcısı etkin;
    diğerleri için anahtar `null` — sessiz geri düşüş yok (birim testli).
  - Gemini platform sırasında yoktu; kullanıcı Gemini bağlarsa OpenAI uyumlu
    ucuyla kullanılır.
  - Beş çağrı yeri `noteProviderResponse` ile 401/403/429'u not eder: yanıta
    `X-AI-Key-Status` (CORS'ta açık), bağlantının son durumu güncellenir;
    istemcideki tek axios yakalayıcısı "anahtarın çalışmadı" bildirimi
    gösterir.
  - Kullanım logunda `anahtar=user|platform` (3.9); anahtar hiçbir logda yok
    (test logları yakalayıp tarıyor).
  - Depo arayüzü: MongoDB; veritabanı bağlı değilken yalnız geliştirmede
    bellek (yerel `.env`'deki veritabanı adresi şablon — yerelde denemek
    için). Canlıda veritabanı yoksa uç 503.
  - Anahtar denemesi model listesiyle (token harcamaz); dakikada 5 sınırı.
  - Geçersiz anahtar kaydedilir ama etkin yapılmaz.
- **Testler:** sunucu birim yeni `keyVault` 5/5, `aiConnections` 6/6
  (anahtar yanıtta/logda/şifreli alanda yok; geçersiz anahtar etkin değil;
  girdi denetimi, 401, kapalıyken 503; bağlantı varken yalnız kullanıcının
  sağlayıcısı, başka kullanıcı etkilenmez, varsayılana dönüş; 401'de başlık
  ve durum güncellemesi); e2e yeni `ai-connections.spec.js` 4/4. Yerelde
  gerçek uç: `GET /api/ai-connections` → `enabled: true, storage: memory`.
  Tam kontrol sonuçları commit mesajında.
- **Ölçülen etki:** ölçülmedi.
- **Bilinen eksikler:** OpenAI / Anthropic / OpenRouter bağdaştırıcıları
  yok (faz 2). `embeddingService` (gömme) ve kapalı eski yazar paneli
  (`aiService.js`, `deepseek.js`) bizim anahtarla çalışır — bağlam onları
  kapsamaz (gömme kullanıcıya görünen bir model adımı değil; eski panel
  kapalı). Model sınıfı uyarısı (3.7, doğrulama adımı) WO-005 ile.
  Kullanıcının gerçek anahtarıyla elle deneme yapılmadı (anahtar yok).
- **Yerel kurulum:** `server/.env`'e `BYOK_ENABLED=true` ve rastgele
  `KEY_ENCRYPTION_KEY` eklendi (gitignore'da). Canlıya alırken Render'a
  gizli değişken olarak girilmeli (onay noktası).
- **Sonraki adım:** kaynak lisans tablosu.
- **Durum:** NEEDS ATTENTION — testler geçti; gerçek sağlayıcı anahtarıyla
  elle deneme bekliyor.
