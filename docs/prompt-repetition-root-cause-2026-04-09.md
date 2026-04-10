# Prompt Tekrarı ve Otomatik Durma Analizi

Tarih: 9 Nisan 2026  
Kapsam: Kod yazmadan, verilen prompt + çıktıya göre kök neden analizi

## 1) Olay Özeti

Verilen prompt normalde tek seferde bir Next.js todo uygulaması üretmesi gerekirken, model çıktısı şu cümleye kilitleniyor:

`to verify or determine where to place the project. I'll use the Desktop folder by default.`

Bu satır çok sayıda tekrarlandıktan sonra birkaç tool çağrısı yapılıyor ve süreç otomatik olarak duruyor.

## 2) Semptom Profili

- İçerik üretimi yerine tek cümleli döngü oluşuyor.
- Döngü cümlesi “plan/karar verme” dilinde; gerçek çıktı (dosya yapısı + kod) yok.
- Son aşamada araç çağrıları var, fakat görev tamamlanmıyor.
- Süreç “no progress” davranışıyla kesiliyor.

## 3) En Olası Kök Nedenler (Öncelik Sırasıyla)

## P0 - Stream Birleştirme / Delta Tekrarı

Model aynı parçayı birden fazla stream eventi ile gönderdiğinde, istemci tarafında birleşim katmanı bu parçaları metin bazında yeterince deduplikasyon yapmadan ekliyor olabilir.

Tipik sonuç:
- Aynı cümle yüzlerce kez birikiyor.
- Kullanıcı tek bir blokta sonsuz tekrar görür.

Neden güçlü aday:
- Tekrarlanan içerik “kelime kelime aynı”.
- Döngü akışı, modelin tek başına yazdığı farklı cümlelerden çok “yeniden ekleme” paternine benziyor.

## P0 - Tool-Loop “No Progress” Sarmalı

Model her turda aynı niyet cümlesini üretip ardından tool kararı veriyorsa, döngü yöneticisi bir noktada güvenlik amacıyla işlemi sonlandırır.

Tipik sonuç:
- Kısa bir tekrar + birkaç tool denemesi + otomatik stop.

Neden güçlü aday:
- Kullanıcının gözlemindeki “sonra tool çalıştı ve durdu” paterni tam buna uyuyor.

## P1 - Retry/Reconnect Sonrası Aynı İçeriğin Yeniden Eklenmesi

Provider veya ağ katmanında yeniden deneme olduğunda aynı delta tekrar gelebilir. İçerik hash/segment id ile korunmuyorsa aynı satır yeniden append edilir.

Tipik sonuç:
- İçerik bir anda blok blok çoğalır.
- Özellikle uzun streamlerde belirginleşir.

## P1 - Provider Event Şeması Uyumsuzluğu

Farklı provider’ların event formatları farklıdır (delta, message, reasoning, tool_call, partial vb.). Parser bir event tipini metin gibi ele alırsa, “iç düşünce/plan” benzeri satırlar son cevaba sızabilir.

Tipik sonuç:
- Kullanıcıya görünmemesi gereken ara metin görünür.
- Aynı tür event tekrarlandıkça aynı cümle görünür.

## P1 - Planlama Cümlesinin Çıktıya Sızması

Agent “proje nereye yazılacak?” kararsızlığında fallback cümlesini tekrar üretip bunu iç log yerine kullanıcı çıktısına taşıyor olabilir.

Tipik sonuç:
- Cevap “ön karar” cümlelerinden oluşur.
- Asıl üretim başlamaz.

## P2 - Durum İdaresi (State) Çakışması

Aynı konuşma turunda birden fazla state güncellemesi (ör. stream text + tool turn text) yarışırsa, eski buffer tekrar tekrar birleştirilir.

Tipik sonuç:
- Cümle sayısı lineer değil katlanarak artabilir.
- UI tarafında aynı metin “yeniden render + yeniden append” etkisi verir.

## P2 - Prompt İçindeki Belirsiz Çalışma Dizini Etkisi

Prompt doğrudan “nereye oluşturulacağı” belirtmiyor. Bazı ajanlar bunu tool ile netleştirmeye çalışır. Bu adım başarısız döngüye girerse tekrar metni üretilir.

Not:
- Bu tek başına yüzlerce tekrar üretmez; ancak yukarıdaki stream/döngü sorunlarını tetikleyebilir.

## P3 - Provider Taraflı Geçici Regresyon

Belirli model sürümünde veya provider gateway’de geçici bir regresyon varsa, aynı “assistant planning” satırı tekrar edilebilir.

Neden daha düşük olasılık:
- Sorun çoğunlukla istemci tarafı birleştirme + loop kontrolü ile daha iyi açıklanıyor.

## 4) Neden Otomatik Olarak Durdu?

En makul açıklama:

1. Model aynı/benzer ara cümleyi tekrar üretti.
2. Sistem bunu ilerleme olarak algılayamadı.
3. Tool çağrılarıyla görev kapanışı denenmiş oldu.
4. “No-progress / repeated-signature / safety break” koşullarından biri tetiklenip süreç sonlandırıldı.

Bu, “sonsuz döngü yerine kontrollü durdurma” davranışıdır.

## 5) Olası Etken Matrisi

- Uygulama katmanı: Stream parser, metin birleştirme, tool-turn yönetimi
- Orkestrasyon katmanı: Retry, timeout, fallback, no-progress guard
- Provider katmanı: Event format farkı, transient stream retry, model regressions
- Prompt katmanı: Çalışma dizini belirsizliği

## 6) Doğrulama Checklist’i (Kod Yazmadan)

## Log düzeyi

- Aynı response id altında tekrar eden delta blokları var mı?
- Aynı tool çağrısı imzası kaç kez tekrarlandı?
- Stop sebebi hangi guard tarafından verildi (timeout, repeated signature, no progress)?

## Stream olayları

- Tekrarlanan metin aynı event id’den mi, farklı eventlerden mi geliyor?
- “reasoning/planning” eventleri kullanıcı görünür kanala taşınıyor mu?

## Retry davranışı

- Ağ/retry sonrası append edilen içerik önceki buffer ile dedupe ediliyor mu?
- Provider reconnect anlarında duplicate suppression çalışıyor mu?

## UI state

- Aynı chunk birden fazla render turunda tekrar append ediliyor mu?
- Tool turn ve text turn birleşim sırası deterministic mi?

## 7) Çözüm Yolları (Uygulama Önceliği)

## Hızlı Mitigasyon

- Final metin katmanında ardışık aynı cümle tekrarı için güçlü dedupe koymak.
- “Planning/intent” cümlelerini kullanıcı çıktısından filtrelemek.
- No-progress eşiklerini düşürüp daha erken kesmek, ama stop nedenini net göstermek.

## Kalıcı Çözüm

- Stream event bazlı idempotent birleştirme (event id/hash ile).
- Provider bazlı parser normalizasyonu (event türleri açık sözleşme ile).
- Tool-loop için “semantic progress score” (gerçek çıktı üretimi yoksa fail-fast).
- Retry/reconnect sırasında “already-seen segments” tablosu.

## 8) Bu Vakaya Özel Sonuç

Bu olay, tek bir nedenden çok muhtemelen iki sorunun birleşimi:

- Ana sorun: Stream/append tarafında tekrarın kullanıcı metnine yansıması
- İkincil sorun: Tool-loop no-progress guard’ın geç devreye girmesi

Bu kombinasyon, kullanıcıda “aynı satır sonsuz tekrar + birkaç tool + otomatik durma” şeklinde gözlenir.

