# LiteratureAI - Akademik Araştırma ve Yazım Asistanı

LiteratureAI, araştırmacıların makale bulmasını, analiz etmesini ve RAG (Retrieval-Augmented Generation) mimarisiyle akademik metinler üretmesini sağlayan profesyonel bir platformdur.

## 🚀 Özellikler
- **Akademik Arama:** DOAJ, Scopus ve OpenAlex entegrasyonu ile milyonlarca makale içinde arama.
- **RAG Mimari:** Seçilen makalelerin özetlerini (abstract) akıllıca parçalara (chunk) böler ve konuya en alakalı olanları LLM'e sunar.
- **Hybrid Search:** Keyword eşleşmesi ve MongoDB Atlas Vector Search (Semantic) kombinasyonu ile en doğru veriyi bulur.
- **Caching:** Gemini embedding sonuçlarını MongoDB'de saklayarak maliyeti düşürür ve hızı artırır.
- **Fail-Safe Fallback:** Gemini, Groq ve yerel semantik algoritmalar arasında otomatik geçiş yaparak kesintisiz hizmet sağlar.
- **Export:** Hazırlanan metinleri DOCX (Word) veya TXT formatında indirme.

## 🛠️ Kurulum

### 1. Depoyu Klonlayın
```bash
git clone <repo-url>
cd literature-ai
```

### 2. Bağımlılıkları Yükleyin
```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
```

### 3. Ortam Değişkenleri (.env)
`server/.env` dosyasını oluşturun ve şu bilgileri girin:
```env
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
MONGODB_URI=your_mongodb_uri
```

### 4. Çalıştırma
```bash
# Geliştirme modunda (Kök dizinden)
npm run dev
```

## 🧠 RAG Mimarisi
Sistemimiz 4 aşamalı bir veri getirme (retrieval) boru hattı kullanır:
1. **Normalization & Chunking:** Makaleler küçük, anlamlı metin parçalarına bölünür.
2. **Hybrid Keyword Filter:** İlk aşamada en alakalı 20 parça kelime bazlı seçilir.
3. **Semantic Ranking:** Seçilen parçalar MongoDB Atlas Vector Search ile semantik olarak sıralanır.
4. **LLM Synthesis:** En iyi 12 parça, referanslarıyla birlikte Gemini veya Groq'a gönderilerek akademik metin sentezlenir.

## 📄 Lisans
Bu proje MIT lisansı ile lisanslanmıştır.
