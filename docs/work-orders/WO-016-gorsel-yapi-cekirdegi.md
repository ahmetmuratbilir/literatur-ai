# WO-016 — Görsel yapı çekirdeği: sinyal, kural kademesi, eşleştirme, uygunluk

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (17.10.2026, dal `wo-016-gorsel-yapi`, push yok) — bitiş raporu aşağıda; kullanıcı kontrolü bekliyor |
| Kapsam | Tek modül (yalnız istemci, **arayüz yok, model çağrısı yok**) |
| Dosya değişikliği | İzinli (liste aşağıda) — biri mevcut (`claimDetection.js`, yalnız `export`) |
| Tahmini süre | 2 oturum |
| Ön koşul | Yok. S1 (Infographic denemesi) ile **paralel** yürür; çıktısı çizim motorundan bağımsızdır |
| Yol haritası aşaması | P3 |
| Plan | `docs/design/gorsellestirme-plani.md` (bu iş emri orada "WO-A") |

## Problem

Yazım alanı prototipinde paragraftan görsel üretme çalışıyor gibi görünüyor,
ama içerik elle yazılmış: `yazim-alani-prototip.html` içindeki `MODELS`
nesnesi üç örnek paragrafın yapısını sabit tutuyor (17.10.2026, kullanıcıya
açıkça söylendi). Kodda karşılığı yok:

- Paragraftan yapı sinyali çıkaran kod yok.
- Bir etiketin cümlede geçip geçmediğini Türkçe eklere duyarlı biçimde
  sınayan kod yok. Model katmanı (WO-C / PR6.v2) bunsuz doğrulanamaz.
- Hangi şablonun uygun olduğuna karar veren kod yok; prototipte gerekçeler
  elle yazılmış.

Mevcut temel: `client/src/components/workspace/claimDetection.js` 1. kademe
(kural) cümle sınıflandırıcısı; `fold` (Türkçe sadeleştirme) dışa açık,
`CITATION` kalıbı dışa açık değil.

## Neden şimdi

- Model kademesi (WO-C) bu iş emrinin doğrulama ve uygunluk koduna yaslanır;
  önce o yazılırsa modelin çıktısı kontrolsüz kalır.
- Kural kademesi bedava ve belirlenimci: yapısı açık metinlerde (liste,
  yıl, sayı, atıf, argüman) hiç model çağırmadan değer üretir.
- Çıktı çizim motorundan bağımsız bir ara yapıdır; S1 sonucu ne olursa olsun
  boşa gitmez.

## Kapsam

### Dahil

1. **Ara yapı ve şeması** (`visual-structure/1`, sürümlü — tüzük 3.4).
2. **Sinyal profili:** Türkçe ve İngilizce sözlük, aynı kategoriler.
3. **Toleranslı eşleştirme:** bir adayın cümlede nerede geçtiğini bulan
   saf fonksiyon (Türkçe ek kuralları dahil). Kural kademesi bunu
   **kullanmaz** (parçaları zaten cümleden keser); WO-C'deki model çıktısı
   doğrulaması için yazılır ve burada test edilir.
4. **Kural kademesi:** yapısı açık metinlerden ara yapı kurar (aşağıdaki 6 kalıp).
5. **Doğrulama:** ara yapının tutarlılığını sınar, onarır, atılanı sayar.
6. **Şablon uygunluğu:** grafın şekli + profil → her şablon için
   uygun/uymuyor + gerekçe + önerilen.
7. **Kaynak değişimi denetimi** (kullanıcı düzeltmesi 17.10.2026): yapı
   oluşturulduğu andaki paragrafın kopyasını ve hash'ini taşır; paragraf
   sonradan değişirse şekil bozulmaz, durum bildirilir.

### Hariç

- Arayüz, çizim, düzenleyici (WO-D / prototip).
- Model çağrısı, PR6.v2 (WO-C).
- Word/PDF'e gömme (WO-008).
- Veriden görseller: sepet yılları, PRISMA, analiz grafikleri (WO-B).
- Serbest düzyazıdan düğüm çıkarma: kural kademesi bunu **yapmaz**;
  yapamadığını söyler (`structure: null`, `reason`).
- Kelime bulutu (kullanıcı kararı 17.10.2026: dışarıda).

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar

- `client/src/visuals/schema.js` (yeni) — `VISUAL_SCHEMA_VERSION`, yapı oluşturucular, şekil denetimi
- `client/src/visuals/signals.js` (yeni) — sözlük (TR + EN) ve `profileOf(sentences, lang)`
- `client/src/visuals/match.js` (yeni) — `matchSpan(sentence, candidate, lang)`
- `client/src/visuals/rules.js` (yeni) — kural kademesi, `structureFromRules(paragraph)`
- `client/src/visuals/validate.js` (yeni) — `validate(structure)`
- `client/src/visuals/fit.js` (yeni) — `fitTemplates(structure, profile)`
- `client/src/visuals/source.js` (yeni) — `paragraphHash(text)`, `checkSource(structure, currentText)`
- `client/src/components/workspace/claimDetection.js` (mevcut) — **yalnız** `CITATION` sabitine `export` eklenir; davranış değişmez
- `client/tests/visuals.test.js` (yeni)
- `client/tests/fixtures/visuals-paragraphs.json` (yeni) — örnek paragraflar ve beklenen çıktılar

Liste yetersizse iş durur ve sorulur.

## Yaklaşım

### 1. Ara yapı (`visual-structure/1`)

```js
{
  schema: 'visual-structure/1',
  lang: 'tr' | 'en',
  source: {                                    // oluşturulduğu andaki kaynak — kopya
    paragraphKey: '…',                         // belgedeki paragraf kimliği (sentenceKey benzeri)
    text: '…',                                 // paragrafın tam metni, o anki hali
    hash: 'sha256:…',                          // normalize edilmiş metnin SHA-256'sı
    createdAt: '…',
  },
  sentences: [{ i: 0, text: '…' }],          // paragrafın cümleleri, splitSentences ile
  profile: { order: 2, cycle: 1, cause: 0, direction: 0, contrast: 1,
             classify: 0, time: 0, number: 0, citation: 1 },
  nodes: [{ id: 'n1', sentence: 0, start: 12, end: 27, text: 'bozunma ısısı',  // text: konumdaki parçanın kopyası
            occurrence: 0,   // text cümlede birden çok geçiyorsa kaçıncısı (0'dan)
            origin: 'rule' | 'model' | 'user', role?: 'claim' | 'premise' | 'limitation',
            value?: { number, unit } | { year } }],
  edges: [{ id: 'e1', from: 'n1', to: 'n2', sentence: 1,
            start: 30, end: 48 | null, text: '…' | null, occurrence: 0 | null, polarity: '+' | '-' | null, origin }],
  dropped: [{ kind: 'node' | 'edge', reason: 'not_in_sentence' | 'dangling' | 'duplicate', detail }],
  fit: [{ template: 'akis', ok: true, recommended: true, reason: 'tr anahtarı' }],
}
```

- **Etiket hem konumuyla hem metniyle saklanır** (`sentence`, `start`,
  `end`, `text`). `text`, oluşturma anında `sentences[i].text.slice(start, end)`
  ile alınan cümledeki asıl biçimdir; tolerans kullanılsa da "etiket
  cümleden birebir" sözü bozulmaz. Elle düzenlenen etiket ayrı alanda
  (`userText`) ve `origin: 'user'` (tüzük 3.6).
- **Şekil kendi metnini taşır.** Çizim ve dışa aktarma yalnız yapının
  içindeki `text` / `userText` alanlarını kullanır; canlı paragrafı okumaz.
  Paragraf değişse ya da silinse de belgedeki şekil ve DOCX çıktısı aynı kalır
  (DOCX tarafı WO-008; bu iş emri yapının buna yetmesini sağlar).

### 1a. Kaynak değişimi — `checkSource(structure, currentText)`

Hash: paragraf metni NFC'ye çevrilir, boşluklar tek boşluğa indirilir, SHA-256
(Web Crypto; tarayıcıda ve Node'da aynı). Yalnız boşluk değişikliği "değişmedi"
sayılır.

| Durum | Ne zaman | Şekle ne olur | Arayüzün göstereceği (WO-D) |
| --- | --- | --- | --- |
| `unchanged` | Hash aynı | Hiçbir şey | — |
| `relocated` | Hash farklı, ama her etiketin `text`'i aynı cümlede birebir bulundu (ör. başka yere kelime eklendi) | Konumlar güncellenir; şekil aynı | Hafif not, eylem gerekmez |
| `changed` | En az bir etiketin `text`'i artık bulunamıyor | **Şekil bozulmaz**, saklanan metinle çizilmeye devam eder; kaybolan etiketler listelenir | "Kaynak paragraf değişti" + **Yeniden oluştur / Olduğu gibi bırak** |
| `missing` | Paragraf belgede yok | Şekil saklanan metinle durur | "Kaynak paragraf silindi" + **Olduğu gibi bırak / Şekli kaldır** |

- "Olduğu gibi bırak" seçilince yapı `source.detached: true` alır; uyarı bir
  daha çıkmaz, üzerine gelince cümle vurgusu kapanır (bağ koptuğu için).
- "Yeniden oluştur" yeni bir yapı üretir; eski yapı geri al için saklanır.
- `relocated`'da arama yalnız **aynı cümle sırasında ve birebir** yapılır
  (tolerans yok): yanlış yere bağlanmaktansa `changed` demek güvenlidir.
- **Geçiş sırası** (kullanıcı eki 17.10.2026): etiket metni cümlede birden
  çok geçiyorsa `occurrence` hangisi olduğunu tutar. Konum takibi sıra
  numarasına değil **değişen bölgeye** dayanır, çünkü etiketten önce aynı
  kelime eklenirse sıra numarası tek başına yanlış geçişi gösterir:
  1. Eski ve yeni paragrafın ortak başı ve ortak sonu bulunur; arada kalan
     tek değişen bölgedir.
  2. Etiket tamamen ortak başta ya da ortak sondaysa yeri kesin bilinir
     (ortak sondaysa uzunluk farkı kadar kayar) → `relocated`; `occurrence`
     yeni metne göre güncellenir.
  3. Değişen bölge etiketle kesişiyorsa: etiket metni aynı cümlede
     **tam bir kez** geçiyorsa oraya bağlanır; hiç geçmiyorsa ya da birden
     çok geçiyorsa `changed`. Başka bir geçiş sessizce seçilmez.
- `checkSource` saf; belgeyi değiştirmez, yeni konumları dönüş değeri olarak verir.
- Gerekçeler metin değil anahtar (`reason: 'fit.cycle.closed'`); metinler
  i18n'de. Arayüz dili değişince yapı değişmez.

### 2. Sinyal sözlüğü

Kategoriler iki dilde aynı: **sıra, döngü, neden, yön, karşıtlık,
sınıflama, zaman, sayı, atıf** (kullanıcı kararı: İngilizce aynı
kategoriler, döngü ve yön dahil). Türkçe kalıplar `fold` sonrası
karşılaştırılır. Her kalıbın yanında bir olumlu ve en az bir olumsuz örnek
cümle testte bulunur ("ise" her zaman karşıtlık değildir: "Sonuç ise
anlamlıdır" ≠ "A artarken B ise azalır").

| Kategori | Türkçe (sadeleştirilmiş) | İngilizce |
| --- | --- | --- |
| sıra | once, ardindan, daha sonra, ilk olarak, son olarak, asama, adim, `^\d+[.)]` | first, then, next, subsequently, finally, step, stage, phase |
| döngü | yeniden, tekrar, geri don, dongu, cevrim | cycle, loop, again, returns to, repeat, recur |
| neden | bagli, etkile, neden ol, yol ac, dolayi, etken, sonucunda | because, cause, leads to, results in, depends on, due to, factor, affect |
| yön | artir, azalt, yukselt, dusur, zayiflat, guclendir | increase, decrease, reduce, raise, lower, weaken, strengthen |
| karşıtlık | ancak, buna karsin, oysa, bununla birlikte, (iki cümle arasında) ise | however, whereas, in contrast, although, nevertheless |
| sınıflama | turleri, cesitleri, (iki\|uc\|dort) … ayril, alt boyut, siniflandir | types of, kinds of, classified, categories, divided into |
| zaman | `\b(1[5-9]\|20)\d{2}\b`, yuzyil, donem | `\b(1[5-9]\|20)\d{2}\b`, century, decade, era |
| sayı | `%\s?\d`, sayı + birim | aynı |
| atıf | `CITATION` (claimDetection) | aynı |

### 3. Toleranslı eşleştirme — `matchSpan(sentence, candidate, lang)`

Dönen: `{ start, end, mode: 'exact' | 'fold' | 'tolerant' } | null`.
`start/end` cümledeki asıl biçimin konumudur. Sıra:

1. **exact:** birebir alt dizgi.
2. **fold:** `fold` sonrası alt dizgi (İ/ı, ş, ğ, büyük/küçük).
3. **tolerant** (yalnız 1–2 tutmazsa): aday kelime kelime, sırası
   korunarak, cümlede **bitişik** kelimelerle eşleşir. Her kelime için:
   - **Tam kelime** eşitse uzunluk şartı yok (su, göç, kan, ağ).
   - **Önek:** aday kelime cümle kelimesinin öneki ve en az **4 harf**
     (neden → nedenleri, yöntem → yöntemin, etken → etkeni).
   - **Ünsüz yumuşaması:** adayın son harfi p/ç/t/k ise b/c/d/ğ-g ile
     de denenir (kitap → kitabı, ağaç → ağacı, renk → rengi, kanat → kanadı).
   - **Ünlü düşmesi:** aday ünsüz–ünlü–ünsüz ile bitiyorsa son ünlü
     düşürülerek de denenir (fikir → fikri, akıl → aklı, isim → ismi,
     hüküm → hükmü, şehir → şehri).
   - **İkizleşme:** son ünsüz ikilenerek de denenir (hak → hakkı,
     his → hissi, zan → zannı).
   - **Kısa kök (< 4 harf):** önek yalnız **kalan parça kapalı bir ek
     listesindeyse** sayılır. Liste: hal ve iyelik ekleri, kaynaştırmalı
     biçimleriyle (ı i u ü a e · yı yi yu yü ya ye · sı si su sü · nın nin
     nun nün · da de ta te · dan den tan ten · ın in un ün · lar ler ·
     ları leri). Örnek: su → suyu, göç → göçü, kan → kanı, ağ → ağı;
     ama ön ↛ önem, kat ↛ katkı, ara ↛ araç. Liste dosyada sabit ve testli.
     Bilinen belirsizlik: art → artı eşleşir (art + ı da geçerli Türkçe).
   - **Birleşik:** kurallar art arda da denenir — kayıp → kaybı,
     kayıt → kaydı (düşme + yumuşama); tıp → tıbbı, ret → reddi
     (yumuşama + ikizleşme). Deneme sayısı sınırlı: kelime başına en fazla
     iki kural.
   - İngilizce: -s, -es, -ed, -ing ve tam kelime (cause → causes / caused).

**Bilinen yanlış pozitif** (testte belgelenir, gizlenmez): önek kuralı
anlam farkını görmez (etki → etkileşim). Bu yüzden `mode: 'tolerant'`
çıktıda kalır; arayüz bu öğeleri işaretleyebilir. Model kademesinde
(WO-C) modelden **cümledeki biçim** istenir; tolerans yalnız yedektir.

### 4. Kural kademesi — altı kalıp

Yalnız bunlar; serbest düzyazı kural kademesinin işi değildir.

| # | Kalıp | Ara yapı | Örnek |
| --- | --- | --- | --- |
| R1 | Numaralı ya da madde işaretli liste | Sıralı düğüm zinciri (akış) ya da tek kökten çocuklar (hiyerarşi; giriş cümlesinde sınıflama sinyali varsa) | "Yöntem üç aşamadan oluşur: 1) … 2) … 3) …" |
| R2 | Sıra işaretli cümle zinciri: ardışık ≥3 cümlenin başında sıra işareti | Her cümle bir adım; düğüm = cümlenin işaretten sonraki kısmı | "İlk olarak … Ardından … Son olarak …" |
| R3 | "X'in nedenleri/etkenleri: a, b ve c" · "X; a, b ve c'ye bağlıdır" · "X depends on a, b and c" | a, b, c → X (balık kılçığı / neden) | "Akış kararsızlığı düşük güç, iki fazlı akış ve geometriye bağlıdır." |
| R4 | ≥2 cümlede yıl | Yıl sırasına göre zaman noktaları; düğüm = yılın geçtiği cümle parçası | "1979'da … 1986'da … 2011'de …" |
| R5 | Argüman: `classifySentence` iddia + atıf durumu + karşıtlık başı | Rol düğümleri (`claim`/`premise`/`limitation`), atıf durumu belgeden | Prototipteki 1.1 paragrafı |
| R6 | ≥2 sayı aynı birimle / yüzdeler | `value` taşıyan düğümler; yüzdelerde toplam | "%42 … %35 … %23" |

Kalıp tutmazsa `structure: null, reason: 'rules.none'` — boş şema yok.

### 5. Doğrulama — `validate(structure)`

- Her düğüm/kenar konumu cümle sınırları içinde ve `slice` boş değil.
- Kenarın iki ucu var olan düğüm (yoksa `dangling`, atılır).
- Aynı konumdaki düğüm tekilleştirilir (`duplicate`).
- Kutup işareti yalnız kenarın cümlesinde yön sinyali varsa kalır; yoksa
  `null` yapılır (uydurma +/− yok).
- Atılan her öğe `dropped`'a yazılır; sayı arayüzde gösterilebilir (2.8).

### 6. Şablon uygunluğu — `fitTemplates(structure, profile)`

Karar grafın şeklinden; model vermez.

| Şablon | Uygun koşulu |
| --- | --- |
| akış | Tek yol (zincir), ≥3 düğüm |
| döngü | Graf kapanıyor **ve** döngü sinyali |
| hiyerarşi | Ağaç (tek kök, döngüsüz) |
| balık kılçığı | ≥2 kaynak → tek hedef |
| geri besleme | Graf kapanıyor **ve** bütün kenarların kutbu dolu |
| kavram haritası | ≥3 düğüm ve bütün kenarlar etiketli |
| argüman | ≥1 `claim` rolü |
| zaman çizelgesi | ≥2 yıllı düğüm |
| çubuk | ≥2 aynı birimli sayı |
| pasta | Yüzdeler, toplam 100 ± 1 |
| karşılaştırma, dörtlü | Kural kademesinde **uymuyor** (iki taraf/eksen modelle çıkarılır) |

Önerilen: uygunlar içinde profil sinyali en güçlü olan. Gerekçe anahtarı her
şablon için döner (uygun ya da uymuyor).

## Kabul kriterleri

- [ ] `matchSpan` şu örneklerin hepsini doğru eşliyor ve dönen `start/end`
      cümledeki asıl biçimi gösteriyor:
      - yumuşama: kitap→kitabı, ağaç→ağacı, renk→rengi, kanat→kanadı
      - önek: etki→etkisi, etken→etkeni, neden→nedenleri, yöntem→yöntemin
      - ünlü düşmesi: fikir→fikri, akıl→aklı, isim→ismi, hüküm→hükmü, şehir→şehri
      - ikizleşme: hak→hakkı, his→hissi, zan→zannı
      - birleşik: kayıp→kaybı, kayıt→kaydı, tıp→tıbbı, ret→reddi
      - kısa kök: su→suyu, göç→göçü, kan→kanı, ağ→ağı
      - fold: İnsan/insan, ISIL/ısıl
      - İngilizce: cause→causes, increase→increased
- [ ] Olumsuz örnekler eşleşmiyor: ara↛araç, kat↛katkı, ön↛önem;
      belgelenmiş belirsizlikler (etki→etkileşim, art→artı) testte
      `mode: 'tolerant'` olarak sabitlenmiş
- [ ] Sözlükte her kalıbın olumlu ve olumsuz örneği var; iki dilde aynı
      kategoriler
- [ ] R1–R6'nın her biri için en az 2 Türkçe ve 1 İngilizce fikstür
      paragrafı beklenen yapıyı veriyor; kalıbı tutmayan 3 paragraf
      `structure: null` dönüyor
- [ ] Prototipteki üç paragrafın (argüman, etkenler, döngü) **elle yazılmış
      graflarıyla** `fitTemplates` prototiptekiyle aynı önerilen şablonu ve
      aynı uygun/uymuyor listesini veriyor (karar koda taşındı)
- [ ] Prototipteki argüman paragrafı (1.1) kural kademesinden (R5) aynı
      rol ve atıf durumlarını veriyor
- [ ] `validate` sarkan kenarı, yineleneni ve cümle dışı konumu atıp
      `dropped`'a yazıyor; dayanaksız kutup işaretini siliyor
- [ ] Her düğüm ve etiketli kenar `text` taşıyor ve `text` oluşturma anındaki
      konum parçasına eşit; yapı `source.text` ve `source.hash` taşıyor
- [ ] `checkSource` testleri:
      - **metin değişmedi** → `unchanged`; yalnız boşluk değişti → `unchanged`
      - **paragrafa kelime eklendi**, etiketlerin dışına → `relocated`, yeni konumlar doğru
      - **kelime eklendi/değişti**, bir etiketin içine → `changed`, kaybolan etiket listede
      - **paragraf silindi** (`currentText` null) → `missing`
      - `detached: true` olan yapı → uyarı üretmiyor
      - cümle sırası değişti, etiket başka cümlede birebir duruyor → `changed`
        (yanlış bağlamaktansa uyar)
      - etiket kelimesi cümlede iki kez geçiyor, ikincisi etiketli:
        - etiketten **sonra** üçüncü geçiş eklendi → `relocated`, yine ikinci geçiş
        - etiketten **önce** yeni geçiş eklendi → `relocated`, aynı kelime
          (artık üçüncü geçiş; sıra numarası tek başına yanlışa giderdi)
        - etiketli geçişin kendisi değiştirildi, cümlede hâlâ başka geçiş var
          → `changed` (sessizce öbürüne bağlanmaz)
- [ ] Çizim/dışa aktarma için yazılan yardımcı (`labelOf(structure, item)`)
      canlı paragrafa erişmeden, yalnız yapıdan metin döndürüyor (test: paragraf
      silinmiş yapıda da aynı etiketler)
- [ ] `client/src/visuals/` saf: ağ, depolama, DOM yok (grep)
- [ ] `claimDetection.js`'te yalnız `export` eklendi; mevcut testler değişmeden geçiyor
- [ ] `npm test`, `npm run lint`, `npm run build` geçiyor; paket boyutu
      değişmiyor (modül çağrılmıyor)
- [ ] Bölüm 3 ihlali yok

Bölüm 4 regresyon seti çalıştırılmaz: bu iş emri model kullanmıyor. Model
kademesinin ölçümü E5 ile WO-C'de.

## Test planı

| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Başlangıç çizgisi | İşe başlamadan `cd client && npm test` | Sayı kaydedilir |
| Görsel çekirdek | `cd client && npm test` | Yeni testler + başlangıç çizgisi geçiyor |
| Lint / build | `npm run lint`, `npm run build` | Temiz; `index-*.js` değişmedi |
| Saflık | `grep -rnE "fetch\|axios\|localStorage\|document\.\|window\." client/src/visuals/` | Boş |
| Dosya kapsamı | `git status --porcelain` | Yalnız listedeki yollar |

Elle kontrol gerekmiyor: arayüz yok.

## Ölçüm

| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| `matchSpan` örnek listesi | — | Tamamı geçiyor |
| Kural kademesinin karşıladığı fikstür paragrafı | — | Ölçülür ve raporlanır (hedef konmaz; E5'te gerçek oran) |
| Prototip kararlarıyla uyum (`fitTemplates`) | Elle | 3/3 paragrafta aynı |

## Geri alma

`client/src/visuals/` ve iki test dosyası silinir; `claimDetection.js`'teki
tek `export` geri alınır (`git revert`). Kullanıcı yüzeyi yok, bayrak
gerekmiyor. Dal: `wo-016-gorsel-yapi`.

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Türkçe ek kuralları eksik kalır | Yüksek | Orta | Tolerans yalnız yedek; WO-C'de model cümledeki biçimi verir; kaçan örnek teste eklenir |
| Önek kuralı yanlış pozitif (etki→etkileşim) | Orta | Orta | `mode: 'tolerant'` çıktıda; belgelendi |
| Sözlük yanlış pozitif ("ise") | Orta | Düşük | Profil tek başına karar vermez; olumsuz örnek testleri |
| Kapsam kayması: "serbest metinden de kurallarla çıkaralım" | Yüksek | Orta | Hariç listesinde; R1–R6 sabit |
| `claimDetection.js` değişikliği davranışı bozar | Düşük | Orta | Yalnız `export`; mevcut testler değişmeden geçmek zorunda |

## Onay gereken noktalar

- Taslak → Hazır (kullanıcı).
- R1–R6 dışında bir kalıp eklemek gerekirse: iş durur, sorulur.

## Bitiş raporu

**Commit'ler** (dal `wo-016-gorsel-yapi`, `wo-006-istatistik` üzerinden; push yok):
`e297797` Faz 0 belgeler · `da0591a` Faz 1 · `2586cd9` Faz 2 · Faz 3 (bu rapor).

**Değişen dosyalar** — `git status` yalnız listedeki yolları gösterdi:

- yeni: `client/src/visuals/{schema,signals,match,rules,validate,fit,source}.js`
- yeni: `client/tests/visuals.test.js` (62 test), `client/tests/fixtures/visuals-paragraphs.json` (22 paragraf)
- mevcut: `client/src/components/workspace/claimDetection.js` — yalnız `CITATION`'a `export` (diff: 1 satır)

**Teknik kararlar**

1. **Etiket konum + metin kopyasıyla saklanır; çizim yalnız kopyayı okur**
   (`labelOf`). Paragraf silinse de etiketler aynı (test).
2. **exact/fold eşleşmesi kelime sınırında.** Sınırsız alt dizgi "kan"ı önce
   gelen "kanat"ın içine bağlıyordu; ekli biçim (`nedenleri`) `tolerant`'a düşer.
3. **Türkçe ek kuralları fold sonrası çalışır.** fold ç→c ve ğ→g yaptığı için
   ç/c ve k/ğ yumuşaması kendiliğinden kalkar; kod p→b, t→d, k→g, ünlü düşmesi,
   ikizleşme ve en fazla iki kuralın birleşimini dener. Kısa kök (< 4) yalnız
   kapalı ek listesiyle.
4. **Kaynak değişiminde konum takibi değişen bölgeye dayanır**, geçiş sıra
   numarasına değil: etiketten önce aynı kelime eklenince sıra numarası
   tek başına yanlış geçişi gösterirdi. Değişen bölge etiketle kesişirse ve
   kelime cümlede birden çok geçiyorsa `changed` (sessiz seçim yok).
5. **Yalnız boşluk değişikliği `unchanged`**, ama konumlar yine güncellenir
   (vurgu kaymasın).
6. **Kural kademesi ayraçsız neden cümlelerini almaz** ("X a ve b'ye
   bağlıdır"): sonucun nerede bittiği noktalamasız güvenle bulunamıyor;
   fikstürde `none-tr-3` olarak sabit.
7. **Uygunluk tamamen graf şekliyle:** hiyerarşi için "aynı yönde ≥ 2 dal"
   şartı, düz zinciri hiyerarşi saymamak için; akış, döngüyü de kapsar
   (prototipin kararı).

**Bulunup düzeltilen hatalar (testlerle):** "42%" sayılmıyordu (`%`'den sonra
`\b`); yönelme ekinde "-ne" unutulmuştu ("eksikliğine" → "eksikliğin");
liste öğesinin başındaki bağlaç atılmıyordu ("ve %23'ü").

**Çalıştırılan testler ve gerçek çıktıları**

| Komut | Çıktı |
| --- | --- |
| Başlangıç `npm test` | 145/145 |
| `npm test` (Faz 1 / 2 / 3 sonrası) | 165/165 · 192/192 · **207/207** |
| `npx eslint .` | temiz |
| `npm run build` | `index-CL8Nnd0U.js` 568,43 kB — başlangıçla aynı (değişiklikler kenara alınarak ölçüldü) |
| Saflık (`fetch\|axios\|localStorage\|document.\|window.` in `src/visuals/`) | eşleşme yok |
| Kontrol karakteri taraması (yeni dosyalar) | 0 |

**Kabul kriterleri**

| Kriter | Durum |
| --- | --- |
| `matchSpan` örnek listesi (yumuşama, önek, ünlü düşmesi, ikizleşme, birleşik, kısa kök, fold, İngilizce) | Geçti |
| Olumsuz örnekler; belirsizlikler `tolerant` olarak sabit | Geçti |
| Sözlükte her kalıbın olumlu ve olumsuz örneği | **Geçti** (ek commit, 17.10.2026): 107 kalıbın her biri için ayrı olumlu + olumsuz örnek (TR 57, EN 50). Testler 8 kusur buldu, düzeltildi — yanlış pozitif: "artış"→"artist", "loop"→"loophole", "again"→"against", "rais"→"raisin", "lower"→"lowercase"; eksik: "artan", "yükselir", "düşer", "buna karşılık" |
| R1–R6 için ≥ 2 TR + 1 EN; kalıpsız ≥ 3 paragraf `null` | Geçti (4 kalıpsız) |
| Prototipteki üç paragrafın kararları koddan aynı | Geçti (döngü, etkenler, argüman) |
| Argüman paragrafı R5'ten aynı rol ve atıf durumu | Geçti |
| `validate` atar, sayar, dayanaksız kutbu siler | Geçti |
| `text` + `source.text` + `source.hash` | Geçti |
| `checkSource` senaryoları (değişmedi, boşluk, dışarı ekleme, içeri ekleme, silindi, detached, cümle sırası, geçiş sırası üç durum) | Geçti |
| `labelOf` canlı paragraf olmadan | Geçti |
| Saflık, `claimDetection` tek `export`, test/lint/build, boyut aynı | Geçti |

**Ölçülen etki:** kural kademesinin gerçek paragraflarda karşılama oranı
**ölçülmedi**; fikstürler bu iş için yazıldı, oran sayılmaz. Gerçek oran E5
ile (WO-C).

**Bilinen eksikler ve riskler**

- Arayüze bağlı değil (bilinçli; WO-D).
- "ise" karşıtlık kuralı kaba: yalnız "-ken" yan cümlesiyle.
- Önek kuralı anlam farkını görmez (etki → etkileşim); `tolerant` kipiyle işaretli.
- `checkSource` tek değişen bölge varsayar; paragrafta birbirinden uzak iki
  ayrı düzenleme tek büyük bölge sayılır → gerektiğinden sık `changed`
  (güvenli taraf).
- `evidence.js`'teki `locateSpan` benzer bir iş yapıyor (boşluk/büyük harf
  toleransı); kapsam dışı olduğu için birleştirilmedi.

**Sonraki adım:** sıra gereği WO-008 (şekillerin Word/PDF'e gömülmesi, S1
ölçütleriyle). Ya da arayüzü görmek için WO-D'nin taslağı.

- **Durum:** READY
