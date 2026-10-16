# E5 — Görsel yapı çıkarma: etiketleme kılavuzu

**Durum:** taslak (17.10.2026). Etiketlemeye başlamadan iki etiketleyici
birlikte okur; belirsiz kalan madde etiketlemeden önce burada netleştirilir.

**Kimin için:** iki etiketleyici (proje sahibi ve mümkünse başka alandan bir
akademisyen). İkisi de yapay zekâ değildir. Etiketleyiciler sistemin
çıktısını **görmez** (tüzük 4.3: etiket testten önce belirlenir).

**Ne ölçülecek:** sistem bir paragraftan şema çıkarırken (a) doğru kavramları
buluyor mu, (b) aralarındaki ilişkiyi doğru kuruyor mu, (c) uygun şablonu
öneriyor mu. Tüzük Bölüm 4, plan: `docs/design/gorsellestirme-plani.md` §7.

---

## 1. Paragraf seçimi (30 paragraf)

| Ölçüt | Değer |
| --- | --- |
| Dil | Türkçe ve İngilizce karışık; her dilde en az 12 |
| Disiplin | En az 5 farklı alan (ör. mühendislik, tıp/sağlık, eğitim, iktisat, sosyoloji/psikoloji); hiçbir alan 8'i geçmez |
| Yapı türleri | Her biri en az 3: süreç, döngü, neden–etken, sınıflama, karşılaştırma, argüman, zaman; en az 4 paragrafta **hiçbir yapı yok** (düz anlatım) |
| Zorluk | En az 8 paragraf zor: dolaylı ilişki, olumsuzluk ("etkilemez"), kaçamak dil ("olabilir"), iç içe yapı |
| Uzunluk | 3–8 cümle |

**Kaynak ve telif.** Paragraf ya (a) açık lisanslı (ör. CC-BY) bir yayından
alınır, ya da (b) etiketleyicilerden biri tarafından yazılır. Her paragrafın
kaynağı, lisansı ve alındığı tarih kayda geçer. Lisansı belirsiz metin
kullanılmaz.

Seçimi etiketleyicilerden biri yapar; diğeri seçimde yer almaz (kendi
seçtiğini etiketlemek kolaylaştırır).

---

## 2. Her paragraf için ne işaretlenir

### 2.1 Yapı var mı

`var` / `yok`. Paragraf bir şemaya dönüştürülebilecek açık bir yapı
taşımıyorsa `yok` (düz anlatım, tek fikir, örnek listesi değil).

### 2.2 Düğümler (kavramlar)

Şemada kutu olacak kavramlar.

- **Cümleden birebir** seçilir: metni değiştirme, kısaltma, kendi
  kelimeni yazma.
- **En kısa anlamlı ifade:** "Isınan soğutucu, pompa gerekmeden yükselen
  kolda…" → düğüm "doğal sirkülasyon", cümlenin tamamı değil.
- Ekler olduğu gibi kalır: cümlede "nedenleri" yazıyorsa "nedenleri" seçilir.
- Aynı kavram birden çok geçiyorsa **bir** düğüm; ilk geçtiği yer seçilir.
- Zamir (bu, bunlar, o) düğüm olmaz; işaret ettiği ifade seçilir.
- Atıf ("(Yılmaz, 2021)", "[14]") düğüme dahil edilmez.
- Her düğümün cümle numarası yazılır.

### 2.3 Kenarlar (ilişkiler)

İki düğüm arasında **metinde açıkça söylenen** ilişki.

- **Yön:** kaynak → hedef ("düşük güç" → "kararsızlık").
- **Etiket:** ilişkiyi kuran fiil öbeği, cümleden birebir ("zayıflatır").
  Metinde ilişki fiili yoksa etiket boş.
- **Kutup (+ / −):** yalnız metinde yön fiili varsa: artırır, yükseltir,
  güçlendirir → `+`; azaltır, düşürür, zayıflatır → `−`. Yoksa boş. **Tahmin
  edilmez.**
- **Olumsuzluk:** "A, B'yi etkilemez" → kenar **çizilmez**, ama paragrafın
  notuna yazılır.
- **Kaçamak dil:** "A, B'yi etkileyebilir" → kenar çizilir, notta "kaçamak"
  işaretlenir.
- **Çıkarım yapılmaz:** "A, B'ye yol açar. B, C'yi artırır." → A→C kenarı
  çizilmez (metinde yok).

### 2.4 Şablon uygunluğu

Dokuz şablonun her biri için `uygun` / `uymuyor`, ve uygunlar arasından
**en uygun** bir tane.

| Şablon | Uygundur, eğer… |
| --- | --- |
| Akış | Adımlar bir sıra izliyor |
| Döngü | Süreç başa dönüyor (metinde açık) |
| Hiyerarşi | Üst–alt, tür–alt tür ilişkisi var |
| Balık kılçığı | Bir sonucun birden çok nedeni sayılıyor |
| Geri besleme | Döngü var **ve** etkilerin yönü (artırır/azaltır) metinde |
| Kavram haritası | En az 3 kavram fiillerle bağlanmış |
| Argüman | İddia, destek ve/veya sınırlılık var |
| Karşılaştırma | İki (ya da daha çok) taraf karşılaştırılıyor |
| Zaman çizelgesi | En az iki tarih/dönem var |

---

## 3. Uyum nasıl ölçülür

| Ne | Ölçü | Nasıl |
| --- | --- | --- |
| Yapı var/yok | Cohen kappa | 30 paragraf üzerinde |
| Şablon uygunluğu (9 şablon × 30) | Cohen kappa, şablon başına ve toplam | Her hücre `uygun`/`uymuyor` |
| En uygun şablon | Yüzde uyum + kappa | 30 paragraf |
| Düğümler | F1 | İki etiketleyicinin düğümü **eşleşir** sayılır: aynı cümlede ve kelimelerinin en az yarısı ortak |
| Kenarlar | F1 (yön dahil); kutupta kappa | Yalnız iki tarafın da eşleşen düğümleri arasında |

Kappa yorumu raporda sayıyla verilir, sıfatla değil ("0,62", "iyi"
değil). Uyumun düşük çıktığı kategori, sistemin de zorlanacağı kategoridir;
ayrıca raporlanır.

---

## 4. Süreç

1. **Kalibrasyon (5 paragraf):** iki etiketleyici birlikte etiketler,
   kılavuzda belirsiz kalan yer burada netleştirilir ve kılavuza yazılır.
   Bu 5 paragraf uyum hesabına **girmez**, altın kümeye girer.
2. **Bağımsız etiketleme (25 paragraf):** ayrı ayrı, birbirinin etiketini
   görmeden.
3. **Uyum hesabı:** §3'teki ölçüler; sonuç `eval/results/` altına tarihle.
4. **Uzlaşma:** uyuşmayan her paragraf konuşulur; karar ve gerekçesi yazılır.
   Uzlaşılamayan paragraf kümeden çıkarılır ve sayısı raporlanır.
5. **Altın küme dondurulur.** Sistem çıktısı ancak bundan sonra
   karşılaştırılır. Altın etiket, sistem çıktısı görüldükten sonra
   değiştirilmez.

Tahmini süre: paragraf başına ~10 dk → etiketleyici başına ~5 saat,
uzlaşma ~2 saat.

---

## 5. Kayıt biçimi

`eval/e5_visual_structure.jsonl`, sürüm kontrolünde, bir satır bir paragraf:

```json
{
  "id": "e5-007",
  "lang": "tr",
  "discipline": "mühendislik",
  "source": { "kind": "cc-by", "ref": "doğrulanmış kayıt kimliği", "license": "CC-BY-4.0", "taken_at": "2026-10-20" },
  "sentences": ["…", "…"],
  "has_structure": true,
  "nodes": [{ "id": "n1", "sentence": 1, "text": "düşük güç seviyesi" }],
  "edges": [{ "from": "n2", "to": "n1", "sentence": 1, "label": "zayıflatır", "polarity": "-" }],
  "fit": { "akis": false, "dongu": false, "hiyerarsi": true, "balik": true, "geri": false, "kavram": true, "arguman": false, "karsi": false, "zaman": false },
  "best": "balik",
  "notes": "Kaçamak dil yok; olumsuzluk yok.",
  "labeled_by": ["A", "B"],
  "agreement": "uzlaşma",
  "labeled_at": "…"
}
```

Etiketleyici adları dosyada kısaltmayla tutulur; açık adlar yalnız proje
kaydında.

---

## 6. Sık sorular

- **Başlık ya da şekil başlığı paragrafa dahil mi?** Hayır.
- **İki şablon eşit uygunsa?** İkisi de `uygun`; "en uygun"da metnin
  vurguladığı yapı seçilir, gerekçe nota yazılır.
- **İngilizce paragrafta Türkçe terim varsa?** Olduğu gibi kalır.
- **Cümle bölünmesi tartışmalıysa?** `sentences` alanındaki bölünme esastır;
  seçimi yapan kişi hazırlar.
