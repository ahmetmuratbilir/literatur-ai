# LiteratureAI Deployment Smoke Test Checklist

Bu dosya, LiteratureAI projesinin Render (Backend) ve Vercel (Frontend) üzerine deploy edildikten sonra yapılması gereken gerçek kullanıcı testlerini içerir.

## 1. Bağlantı ve Temel Fonksiyonlar
- [ ] Uygulama ana sayfası hatasız yükleniyor mu?
- [ ] Clerk giriş/kayıt penceresi açılıyor mu?
- [ ] Kullanıcı girişi yapılabiliyor mu?
- [ ] Arama motoru sonuç döndürüyor mu?

## 2. RAG Pipeline (WriterPanel) Testleri
- [ ] Arama sonuçlarından 3-4 makale seçilip "Writer" paneli açılabiliyor mu?
- [ ] **Prompt Gönderimi:** Bir konu yazıp "Atıflı Metin Üret" denildiğinde stream başlıyor mu?
- [ ] **Stream Kararlılığı:** Metin harf harf akarken kesinti oluyor mu?
- [ ] **Model Fallback:** Gemini limitine takılırsa Groq otomatik devreye giriyor mu? (Loglardan kontrol edilecek).
- [ ] **Atıf Rozetleri:** Üretilen metinde `[1]`, `[2]` gibi atıf etiketleri doğru görünüyor mu?

## 3. Güvenlik ve Performans Testleri
- [ ] **Rate Limiter:** Hızlıca 5-6 kez üretim isteği gönderildiğinde "Lütfen bekleyin" uyarısı geliyor mu?
- [ ] **Frontend Cooldown:** "Yeniden Üret" butonu 5 saniye boyunca kilitli kalıyor mu?
- [ ] **Response Cache:** Aynı prompt + aynı makaleler girildiğinde sonuç anında (cache'ten) geliyor mu?
- [ ] **Vector Search Hızı:** Vektörel arama sonuçları < 3 saniye içinde geliyor mu?

## 4. Dışa Aktarma (Export) Testleri
- [ ] **DOCX Export:** Üretilen metin Word dosyası olarak indirilebiliyor mu?
- [ ] **İçerik Kontrolü:** Word dosyası içindeki başlıklar ve paragraflar düzgün mü?
- [ ] **CSV/Excel Export:** Arama sonuçları Excel formatında indirilebiliyor mu?

## 5. Altyapı Kontrolleri
- [ ] **MongoDB Atlas:** `chunk_embedding_vector_index` durumu "Active" mi?
- [ ] **Network Access:** Atlas IP whitelist `0.0.0.0/0` olarak ayarlanmış mı?
- [ ] **Render Sleep:** Uygulama uzun süre kullanılmadığında Render "cold start" süresi makul mü?

---
*Son Güncelleme: 13 Mayıs 2026*
