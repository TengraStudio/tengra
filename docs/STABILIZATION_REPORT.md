# Tengra AI Runtime Stabilizasyon Raporu

Bu rapor, AI asistanının çalışma zamanında tespit edilen kritik kararlılık sorunlarını ve bu sorunların çözümü için uygulanan teknik değişiklikleri detaylandırmaktadır.

## 📋 Özet

Yapılan çalışmalarla dört ana başlıkta iyileştirme sağlanmıştır:
1. **İzin Kalıcılığı**: Model bazlı erişim yetkilerinin uygulama kapatılıp açıldığında korunması.
2. **Streaming & Reasoning**: "Düşünme" (reasoning) sürecinin anlık ve temiz bir şekilde kullanıcıya sunulması.
3. **Loop Koruması**: Gereksiz dosya listeleme döngülerinin engellenmesi.
4. **Bağlam Yönetimi**: Ollama modelleri için daha geniş ve güvenli bir çalışma alanı (context window).

---

## 🛠️ Detaylı Değişiklikler

### 1. Yetki Kalıcılığı (Permission Persistence)
**Sorun**: Kullanıcı "Model Selector" üzerinden "Full Access" verse bile, bu bilgi sadece o anki oturumda kalıyor ve uygulama yeniden başlatıldığında sıfırlanıyordu.

**Çözüm**:
- `useChatInputController.ts` dosyasına `SettingsStore` entegrasyonu eklendi.
- Yetki değişiklikleri artık sadece React state'inde tutulmuyor, `updateSettings` fonksiyonu aracılığıyla global `AppSettings` dosyasına (disk üzerine) kaydediliyor.
- `src/shared/types/settings.ts` dosyasında `agentPathPolicy` tipi genişletilerek `full-access` desteği eklendi.

### 2. Akıllı Düşünce (Reasoning) Yakalama
**Sorun**: DeepSeek-R1 gibi modeller düşüncelerini `<think>` tagları arasında gönderiyor ancak bu içerik akış (stream) sırasında bazen kayboluyor ya da mesaj bittikten sonra topluca görünüyordu.

**Çözüm**:
- `process-stream.ts` içine `extractReasoning` yardımcı fonksiyonu eklendi.
- Bu fonksiyon, akış devam ederken (tag henüz kapanmamış olsa bile) `<think>` içeriğini yakalayıp UI'daki "Düşünce" bölümüne anlık olarak aktarıyor.
- `MessageUtils.ts` dosyasında kullanılan Regex'ler güncellenerek, streaming sırasında oluşan yarım kalmış teknik tagların ana mesaj içeriğinde kirlilik yaratması (flicker) engellendi.

### 3. Streaming UI Güncelleme Stabilizasyonu
**Sorun**: Mesajların akış sırasında güncellenmemesi ve sadece durdurulduğunda (stop) yansıması.

**Çözüm**:
- `process-stream.ts` içindeki `handleThrottledUpdates` mekanizması, yeni reasoning extraction logic ile senkronize edildi.
- React state güncellemeleri (`setStreamingStates`), içerik ve düşünce ayrımını her "chunk" geldiğinde yapacak şekilde normalize edildi.

### 4. Dosya Sistemi Tool Loop Koruması
**Sorun**: Modelin `list_directory` gibi araçlardan cevap almasına rağmen, aynı aracı tekrar tekrar çağırmaya devam etmesi (Infinite Loop).

**Çözüm**:
- `tool-turn-management.util.ts` içindeki `evaluateLoopSafety` fonksiyonu modernize edildi.
- **Circuit Breaker**: Eğer sistemde yeterli dosya sistemi kanıtı varsa ve model aynı tool imzasıyla (tool signature) tekrar çağrı yapıyorsa, sistem "kanıt yeterli" diyerek döngüyü zorla sonlandırıyor ve modeli nihai cevaba yönlendiriyor.

### 5. Ollama Context Window Artırımı
**Sorun**: Agent görevlerinde bağlamın yetersiz kalması sonucu araç sonuçlarının kesilmesi.

**Çözüm**:
- `ollama.service.ts` dosyasında varsayılan `numCtx` değeri **16k'dan 32k'ya** yükseltildi.
- Otomatik çözünürlük mantığı iyileştirilerek, agent modunda çalışan modeller için daha geniş bir çalışma alanı sağlandı.

---

## 📂 Değiştirilen Dosyalar

| Dosya Yolu | Amacı |
|------------|-------|
| `src/renderer/features/chat/hooks/useChatInputController.ts` | İzinlerin kaydedilmesi ve store senkronizasyonu. |
| `src/renderer/features/chat/hooks/process-stream.ts` | Anlık reasoning ayıklama ve stream stabilizasyonu. |
| `src/renderer/features/chat/components/message/MessageUtils.ts` | Teknik tag temizliği ve UI görsel bütünlüğü. |
| `src/renderer/features/chat/hooks/tool-turn-management.util.ts` | Loop koruması ve erken çıkış mantığı. |
| `src/main/services/llm/ollama.service.ts` | Context window artırımı ve model bazlı ayar yönetimi. |
| `src/shared/types/settings.ts` | Ayar şemasına `full-access` yetkisinin eklenmesi. |

---

> [!TIP]
> Bu değişiklikler sonrasında uygulama genelinde AI operasyonları daha deterministik ve kullanıcı dostu bir hale gelmiştir. "Thinking" (Düşünüyor...) aşaması artık her modelde daha şeffaf bir şekilde izlenebilir.

> [!IMPORTANT]
> Uygulama ayarlarındaki `agentPathPolicy` artık kalıcıdır. Bir kez "Full Access" verdiğinizde, siz manuel olarak değiştirene kadar tüm oturumlarda geçerli olacaktır.
