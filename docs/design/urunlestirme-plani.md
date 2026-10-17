# Ürünleştirme planı: girip kullanılabilen ürün

**Durum:** plan (17.10.2026). Kullanıcı kararı: tasarım faslı kapandı; hedef
kullanılabilir ürün. Ödeme planları **şimdilik yok** (aşağıda yalnız not).

## 1. Sıra

| # | Ne | İş emri | Görürsün | Durum |
| --- | --- | --- | --- | --- |
| A | **Canlıya al:** WO-011 zinciri (yazar modu, Kontrol, Teslime hazırla, istatistik çekirdeği, WO-016) | — | Canlı sitede yeni yazım yüzeyi | `npm run kontrol` geçti (`b6d557c`); kullanıcının son kontrolü ve "canlıya al" komutu bekleniyor |
| B | **Tek panel kabuk** | WO-017 | Sol rayda Araştırma ilk sırada, ayrı yazar modu yok | Hazır |
| C | **Yapay zekâ bağlantıları** (kullanıcının kendi anahtarı) | WO-023 | Ayarlar › Yapay zekâ: varsayılan Literatür AI, istersen kendi anahtarın | Taslak |
| D | **Sadeleştirme turu** | yazılacak | İçerideki ekranlar daha basit ve anlaşılır | B'den sonra: kullanıcıyla ekran ekran gezinti → liste → iş emri |
| E | Pencereler, şekiller, Word'e şekil, köprü, durumlar, model kademesi | WO-018 → 019 → 008 → 020 → 021 → 022 | Yol haritasındaki gibi | Taslak |
| F | Ödeme planları | — | — | **Ertelendi** (kullanıcı kararı); ön koşullar §4 |

Her adımdan sonra `npm run kontrol` çalışır; rapor geçmeden main'e push
önerilmez. Push yalnız kullanıcının açık komutuyla (CLAUDE.md).

## 2. Rakip incelemesi: assistin.ai (17.10.2026, herkese açık sayfalar)

İnceleme yapı ve özellik düzeyinde. Metin, kod ve görsel alınmaz: telif ve
kullanım şartları; ayrıca tüzük 2.12 — ürün kendi savunabileceği şeyi üretir.

**Ne sunuyorlar** (ana sayfa, fiyatlandırma ve yardım sayfasından):
tek yerde çok model (GPT, Claude, Gemini, DeepSeek, Llama, Grok); "AI
Detector"; araştırma aracı / kaynakça; çoklu sohbet ve "Remix" (modellerin
çıktısını birleştirme); not defteri; sektörel asistanlar; tarayıcı eklentisi;
kurumsal erişim (kütüphane üzerinden form → deneme → dilekçe); kart istemeyen
ücretsiz kayıt (30 basit kredi).

| Fikir | Alıyor muyuz | Neden |
| --- | --- | --- |
| Tek yerde çok sağlayıcı, kullanıcı seçer | **Evet** — WO-023 | Kullanıcı kendi anahtarıyla da çalışabilmeli |
| Kartsız ücretsiz başlangıç, net kayıt akışı | Evet (D'de) | Giriş engelini düşürür |
| Kurumsal erişim: kütüphane üzerinden | **Evet, sonra** | Hedef kitlemiz üniversite; satın alma kütüphaneden geçer |
| Yardım merkezi (SSS) | Evet (D'de) | Basit ve anlaşılır hedefine hizmet eder |
| Fiyat kartı düzeni (4 kart, aylık/yıllık) | Görsel fikir olarak, ödeme gelince | Ertelendi |
| "AI Detector" | **Hayır** | Yapay zekâ tespit puanları güvenilir değil, yanlış pozitif öğrenciye zarar verir; kalibre olmayan puanı olasılık gibi sunmak tüzük 2.8'e aykırı |
| "Kısalt / Genişlet", serbest metin üretimi | **Hayır** | Tüzük 2.2: yazarın yerine yazmayız |
| Modellerin çıktısını birleştiren "Remix" | Hayır | Kaynağa izlenemez (2.12 soru 2) |
| Ana sayfada canlı görünen ama temsili metrikler (token hızı, bellek, yönlendirme yüzdeleri) | **Hayır** | Gerçek olmayan sayı göstermeyiz (2.8) |
| Görsel üretme (DALL-E) | Hayır | Akademik kanıta bağlı değil |

**Ders:** fiyat sayfalarında kartlar ile karşılaştırma tablosu birbirini
tutmuyor (plan adları ve kredi miktarları farklı). Bizde fiyat, plan ve
özellik listesi tek veri kaynağından üretilir.

## 3. Yapay zekâ bağlantıları (WO-023) — tasarım özeti

Ayrıntı ve kabul kriterleri iş emrinde. İlkeler:

1. **Varsayılan biziz.** Kullanıcı hiçbir şey yapmazsa Literatür AI'nın
   anahtarları ve bugünkü sağlayıcı sırası (`server/config/aiModels.js`)
   çalışır.
2. **Kendi anahtarın:** Ayarlar › Yapay zekâ bağlantıları. Sağlayıcı seç,
   anahtarı yapıştır, "Bağlantıyı dene". İlk sürümde kodda karşılığı olan
   üç sağlayıcı: DeepSeek, Gemini, Groq. OpenAI, Anthropic, OpenRouter
   bağdaştırıcı ister — ikinci faz.
3. **Anahtar istemciye geri dönmez.** Sunucuda AES-256-GCM ile şifreli
   saklanır (ana anahtar ortam değişkeni); arayüz yalnız son 4 haneyi
   gösterir; loglara yazılmaz; tüzük 3.8 "API anahtarları frontend'e konmaz"
   korunur (tarayıcı depolamasına yazılmaz).
4. **Sessiz geri düşüş yok.** Kullanıcının anahtarı hata verirse (geçersiz,
   kota) bizim anahtara gizlice geçilmez; kullanıcıya söylenir, isterse tek
   tıkla varsayılana döner. Hem dürüstlük (2.8) hem maliyet.
5. **Ölçümleme sürer** (3.9): kullanıcının anahtarıyla yapılan çağrıda da
   sağlayıcı, model, token, süre loglanır — anahtarın kendisi asla.
6. **Bilgilendirme:** "Kendi anahtarınla gönderilen metin o sağlayıcının
   kullanım şartlarına tabidir." Bağlantı sayfasında yazar.
7. **Model sınıfı uyarısı** (3.7): doğrulama gibi en güçlü model isteyen
   adımlarda kullanıcı zayıf bir model seçtiyse uyarı.

## 4. Ödeme planları — ertelendi, ama ön koşulları kayıtlı

Gelir başladığı gün geçerli olan, bugünden bilinen çıkış koşulları:

- **ORCID kapanır** (tüzük 2.7): fiyatlandırma sayfası yayına girmeden önce
  `ORCID_ENABLED=false`; kontrol listesi `docs/sources.md`.
- **Kaynakların ticari kullanım koşulları** (2.7): her kaynak
  `APPROVED_FOR_PRODUCTION` olmadan ücretli üründe kullanılmaz.
- **Ödeme sağlayıcısı** Türkiye'de çalışan biri olmalı; seçim ayrı karar.
- Kendi anahtarını kullanan kullanıcının model çağrıları için kredi düşüp
  düşmeyeceği o gün kararlaştırılır.

## 5. Sadeleştirme turu (D) nasıl yapılacak

WO-017 bittikten sonra kullanıcıyla ekran ekran gezilir. Her ekran için üç
soru: bu ekranda ilk ne yapılır, gereksiz ne var, hangi kelime anlaşılmıyor.
Çıkan liste tek iş emrine dönüşür; tasarım değil, sadeleştirme (kaldır,
birleştir, yeniden adlandır).
