const sectionData = {
    "general": {
        "unknownError": "Bilinmeyen bir hata oluştu",
        "operationFailed": "İşlem başarısız",
        "invalidInput": "Geçersiz giriş",
        "networkError": "Ağ hatası",
        "permissionDenied": "İzin verilmedi"
    },
    "unexpected": "Üzgünüz, bir hata oluştu.",
    "somethingWentWrong": "Bir şeyler yanlış gitti:",
    "unexpectedDescription": "Uygulama beklenmeyen bir hatayla karşılaştı.",
    "errorMessageLabel": "Hata Mesajı",
    "technicalDetails": "TEKNİK DETAYLAR (YIĞIN İZİ)",
    "copyDetails": "Detayları kopyala",
    "rootNotFound": "Kök öğe bulunamadı",
    "ipcValidation": {
        "hostRequired": "Ana makine gereklidir.",
        "usernameRequired": "Kullanıcı adı gereklidir.",
        "tokenRequired": "En az bir token alanı bulunmalıdır.",
        "invalidUrlOrProtocol": "Geçersiz URL veya desteklenmeyen protokol."
    },
    "rateLimitWarning": "Hız sınırı uyarısı ({{provider}}): {{remaining}}/{{limit}} kalan",
    "rateLimit": {
        "exceeded": "Hız sınırı aşıldı. Lütfen bekleyip tekrar deneyin.",
        "retryAfterSeconds": "Hız sınırı aşıldı. Lütfen {{seconds}} saniye sonra tekrar deneyin.",
        "requestThrottled": "{{provider}} için istek kısıtlandı. Çok fazla istek gönderildi.",
        "limitReset": "Hız sınırı {{minutes}} dakika içinde sıfırlanacak.",
        "waitExceeded": "{{provider}} için hız sınırı bekleme süresi aşıldı. Lütfen daha sonra tekrar deneyin.",
        "serviceNotInitialized": "Hız sınırı servisi başlatılmadı.",
        "tokenRejected": "{{provider}} için istek hız sınırlaması nedeniyle reddedildi.",
        "configUpdated": "{{provider}} için hız sınırı yapılandırması güncellendi.",
        "providerLimited": "{{provider}} şu anda hız sınırına ulaştı. {{remaining}}/{{limit}} istek hakkı kaldı.",
        "tooManyRequests": "Çok fazla istek. Lütfen yavaşlayın."
    },
    "proxy": {
        "started": "Proxy {{port}} portunda başarıyla başlatıldı.",
        "stopped": "Proxy durduruldu.",
        "startFailed": "Proxy servisi başlatılamadı.",
        "stopFailed": "Proxy servisi durdurulamadı.",
        "connectionFailed": "Proxy bağlantısı başarısız oldu. Lütfen proxy'nin çalıştığını kontrol edin.",
        "requestFailed": "Proxy isteği başarısız oldu.",
        "portInUse": "{{port}} portu zaten kullanımda.",
        "binaryNotFound": "Proxy çalıştırılabilir dosyası bulunamadı. Lütfen yeniden derleyin veya kurun.",
        "notInitialized": "Proxy servisi başlatılmadı.",
        "invalidConfig": "Geçersiz proxy yapılandırması.",
        "authFailed": "Proxy kimlik doğrulaması başarısız oldu.",
        "timeout": "Proxy isteği zaman aşımına uğradı.",
        "portRequired": "Port gereklidir.",
        "portInvalid": "Port 1 ile 65535 arasında geçerli bir tam sayı olmalıdır.",
        "urlRequired": "Proxy URL'si gereklidir.",
        "urlInvalid": "Proxy URL'si geçerli bir http veya https URL'si olmalıdır.",
        "tokenRequired": "API anahtarı gereklidir.",
        "tokenInvalid": "API anahtarı boş olmayan bir metin olmalıdır.",
        "providerRequired": "Sağlayıcı gereklidir.",
        "providerInvalid": "Sağlayıcı boş olmayan bir metin olmalıdır.",
        "quotaFetchFailed": "Kullanım kotası bilgisi alınamadı.",
        "quotaExceeded": "Kullanım kotası aşıldı."
    },
    "quota": {
        "exceeded": "Kota aşıldı. Lütfen sıfırlanma süresini bekleyin.",
        "limitApproaching": "{{provider}} için kota sınırına yaklaşılıyor: {{remaining}} / {{limit}} kalan.",
        "usageWarning": "{{provider}} kotanızın %{{percentage}} kadarını kullandınız.",
        "authExpired": "Kimlik doğrulama süresi doldu. Kotayı kontrol etmek için lütfen tekrar giriş yapın.",
        "fetchFailed": "Kota bilgisi alınamadı. Lütfen tekrar deneyin.",
        "noAccounts": "Bağlı hesap bulunamadı. Kotayı görüntülemek için bir hesap bağlayın.",
        "invalidSessionKey": "Geçersiz oturum anahtarı. Lütfen geçerli bir oturum anahtarı girin.",
        "invalidInput": "Kota işlemi için geçersiz giriş sağlandı.",
        "parseFailed": "Sağlayıcıdan gelen kota yanıtı ayrıştırılamadı.",
        "refreshFailed": "Kota bilgisi yenilenemedi.",
        "accountLocked": "Hesap kilitli. Lütfen destek ile iletişime geçin.",
        "resetIn": "Kota {{time}} içinde sıfırlanacak.",
        "limitReached": "{{provider}} için kota sınırına ulaşıldı. Lütfen {{resetTime}} zamanına kadar bekleyin."
    },
    "monitoring": {
        "initFailed": "İzleme servisi başlatılamadı.",
        "metricCollectionFailed": "Metrik toplanamadı: {{metricName}}.",
        "thresholdExceeded": "{{metricName}} için kritik eşik aşıldı: {{value}}{{unit}}.",
            "memoryWarning": "Sistem bellek kullanımı %{{percentage}} seviyesine ulaştı.",
        "gcNotAvailable": "Çöp toplama kullanılamıyor.",
            "gcForced": "Zorunlu çöp toplama çalıştırıldı.",
        "snapshotFailed": "Performans anlık görüntüsü alınamadı.",
        "alertTriggered": "İzleme uyarısı tetiklendi: {{alertName}}.",
        "serviceUnavailable": "İzleme servisi kullanılamıyor.",
        "invalidMetric": "Geçersiz metrik adı sağlandı.",
        "exportFailed": "İzleme verileri dışa aktarılamadı."
    },
    "telemetry": {
        "disabled": "Telemetri devre dışı.",
        "invalidEventName": "Geçersiz olay adı sağlandı.",
        "invalidProperties": "Geçersiz olay özellikleri.",
        "invalidBatch": "Geçersiz telemetri grubu.",
        "queueOverflow": "Telemetri kuyruğu taştı. Olaylar kaybedilebilir.",
        "flushFailed": "Telemetri olayları gönderilemedi.",
        "settingsError": "Telemetri ayarları yüklenemedi.",
        "sendFailed": "Telemetri verileri gönderilemedi.",
        "consentRequired": "Veri toplamadan önce telemetri izni gereklidir.",
        "rateLimited": "Telemetri raporlama hızı sınırlandı."
    },
    "theme": {
        "invalidManifest": "Geçersiz tema bildirimi: {{filename}}.",
        "notFound": "\"{{themeId}}\" teması bulunamadı.",
        "installFailed": "Tema yüklenemedi.",
        "uninstallFailed": "Tema kaldırılamadı.",
        "uninstallBuiltin": "Yerleşik tema kaldırılamaz: {{themeId}}.",
        "validationFailed": "Tema doğrulaması başarısız oldu.",
        "permissionDenied": "Tema dosyalarına erişim izni reddedildi.",
        "diskFull": "Tema yüklemek için yeterli disk alanı yok.",
        "corruptFile": "Tema dosyası bozuk veya okunamıyor.",
        "scanFailed": "Tema dizini taranamadı.",
        "loadFailed": "Tema yüklenemedi: {{filename}}.",
        "invalidIdFormat": "Geçersiz tema kimliği biçimi.",
        "saveFailed": "Tema yapılandırması kaydedilemedi."
    },
    "data": {
        "initFailed": "Veri servisi başlatılamadı.",
        "directoryCreateFailed": "Veri dizinleri oluşturulamadı.",
        "migrationFailed": "{{path}} için veri taşıma başarısız oldu.",
        "migrationPathInvalid": "Geçersiz taşıma yolu.",
        "pathTypeInvalid": "Geçersiz veri türü: {{type}}.",
        "fileOperationFailed": "Dosya işlemi başarısız oldu.",
        "permissionDenied": "Veri dosyalarına erişim izni reddedildi.",
        "importFailed": "Veri içe aktarılamadı.",
        "exportFailed": "Veri dışa aktarılamadı.",
        "importSuccess": "Veri başarıyla içe aktarıldı.",
        "exportSuccess": "Veri başarıyla dışa aktarıldı.",
        "corruptData": "Veri dosyası bozuk veya okunamıyor.",
        "cleanupFailed": "Eski veriler temizlenemedi."
    },
    "database": {
        "connectionFailed": "Veritabanına bağlanılamadı.",
        "queryFailed": "Veritabanı sorgusu başarısız oldu.",
        "migrationFailed": "Veritabanı taşıma işlemi başarısız oldu.",
        "migrationSuccess": "Veritabanı taşıma işlemi başarıyla tamamlandı.",
        "initFailed": "Veritabanı başlatılamadı.",
        "notInitialized": "Veritabanı başlatılmadı.",
        "transactionFailed": "Veritabanı işlemi başarısız oldu.",
        "constraintViolation": "Veritabanı kısıtlama ihlali.",
        "timeout": "Veritabanı işlemi zaman aşımına uğradı.",
        "diskFull": "Veritabanı işlemi için yeterli disk alanı yok.",
        "corruptDatabase": "Veritabanı bozuk. Lütfen yedekten geri yükleyin.",
        "backupFailed": "Veritabanı yedeği oluşturulamadı.",
        "backupSuccess": "Veritabanı yedeği başarıyla oluşturuldu.",
        "restoreFailed": "Veritabanı yedekten geri yüklenemedi.",
        "restoreSuccess": "Veritabanı başarıyla geri yüklendi.",
        "slowQuery": "Yavaş sorgu tespit edildi: {{duration}}ms."
    },
    "extension": {
        "sandboxSizeLimit": "Eklenti betiği korumalı alan boyut sınırını aşıyor ({{maxSizeKb}} KB)."
    },
    "copilot": {
        "auth_failed_no_token": "GitHub Copilot kimlik doğrulaması başarısız: Belirteç bulunamadı",
        "token_fetch_failed": "GitHub Copilot belirteci alınamadı"
    },
    "collaboration": {
        "auth_required": "İşbirliği için kimlik doğrulaması gerekiyor",
        "not_connected": "Bir işbirliği oturumuna bağlı değil"
    },
    "voice": {
        "synthesis_unavailable": "Konuşma sentezi kullanılamıyor",
        "recognition_unavailable": "Konuşma tanıma kullanılamıyor"
    },
    "chat": {
        "invalid_messages": "Geçersiz sohbet mesajları",
        "no_messages": "Sohbet mesajı bulunamadı",
        "invalid_id": "Geçersiz sohbet oturumu kimliği",
        "no_user_message_to_retry": "Yeniden denenecek kullanıcı mesajı bulunamadı",
        "invalid_messages_array": "Geçersiz mesaj dizisi"
    },
    "process": {
        "invalid_command": "Geçersiz terminal komutu"
    },
    "workspace": {
        "not_ready": "Çalışma alanı hazır değil"
    },
    "git": {
        "cancel_failed": "Aktif Git işlemi iptal edilemedi",
        "invalid_branch_name": "Geçersiz dal adı",
        "invalid_parameters": "Geçersiz parametreler",
        "invalid_branch_names": "Geçersiz dal adları"
    },
    "terminal": {
        "windows_terminal_unsupported": "Windows Terminal bu işletim sisteminde yüklü değil veya mevcut değil",
        "windows_terminal_path_unresolved": "Windows Terminal yolu çözülemedi",
        "request_timeout": "Terminal isteği zaman aşımına uğradı",
        "backend_not_found": "{{backend}} yüklü değil veya PATH içinde bulunamadı",
        "pty_not_available": "node-pty arka ucu mevcut değil",
        "connection_id_required": "SSH terminali için connectionId gereklidir",
        "container_id_required": "Docker terminali için containerId gereklidir"
    },
    "ssh": {
        "not_connected": "Bağlı değil",
        "connection_profile_not_found": "Bağlantı profili bulunamadı",
        "reconnect_attempts_exhausted": "Yeniden bağlanma denemeleri tükendi",
        "path_traversal_detected": "Erişim reddedildi: Yol aşımı tespit edildi",
        "path_must_be_absolute": "Erişim reddedildi: Yol mutlak olmalıdır",
        "path_must_be_within_var_log": "Erişim reddedildi: Yol /var/log içinde olmalıdır",
        "path_outside_allowed_directories": "Erişim reddedildi: Yol izin verilen dizinler içinde olmalıdır"
    },
    "auth": {
        "legacy_key_unsupported": "Eski düz metin ana anahtar formatı artık desteklenmiyor",
        "encryption_unavailable": "safeStorage şifrelemesi mevcut değil",
        "invalid_key_length": "Şifre çözme sonrası geçersiz ana anahtar uzunluğu",
        "storage_not_available": "Ana anahtarı güvenli bir şekilde kaydetmek için safeStorage mevcut değil",
        "invalid_format": "Geçersiz format (Tengra:v1)",
        "provider_required": "Sağlayıcı gereklidir",
        "server_not_initialized": "Sunucu başlatılmadı"
    },
    "llm": {
        "rate_limit_exhausted": "GitHub API hız sınırı tükendi",
        "response_body_null": "Yanıt gövdesi boş",
        "download_aborted": "İndirme iptal edildi",
        "no_json_found": "Yanıtta JSON bulunamadı",
        "llama_not_running": "llama-server çalışmıyor",
        "invalid_embedding_response": "llama-server'dan geçersiz gömme yanıtı",
        "no_images_returned": "Görüntü döndürülmedi",
        "no_quota_available": "Mevcut kotası olan hesap bulunamadı",
        "experimental_ollama_sd": "Ollama özel görüntü oluşturma hala deneyseldir. Lütfen SD-WebUI kullanın.",
        "comfyui_no_prompt_id": "ComfyUI prompt_id döndürmedi",
        "comfyui_timeout": "ComfyUI sonucu beklenirken zaman aşımına uğradı",
        "quota_service_unavailable": "Kota servisi (QuotaService) mevcut değil",
        "download_failed": "İndirme başarısız oldu"
    },
    "settings": {
        "invalid_payload": "Ayarlar veri yığını (payload) dizi olmayan bir nesne olmalıdır"
    },
    "system": {
        "manifest_read_failed": "Çalışma zamanı manifest önbelleği okuma hatası",
        "https_required": "Çalışma zamanı indirmeleri https kullanmalıdır"
    },
    "mcp": {
        "connectionFailed": "MCP sunucusuna bağlanılamadı: {{server}}",
        "toolNotFound": "MCP aracı \"{{tool}}\" bulunamadı",
        "timeout": "MCP isteği {{seconds}} saniye sonra zaman aşımına uğradı",
        "invalidConfig": "Geçersiz MCP sunucu yapılandırması",
        "executionError": "MCP aracı yürütülemedi: {{error}}"
    },
    "models": {
        "notFound": "Model \"{{modelId}}\" bulunamadı",
        "downloadCorrupt": "Model indirmesi bozuk. Lütfen tekrar deneyin.",
        "presetSaveFailed": "Model hazır ayarı kaydedilemedi",
        "gpuNotAvailable": "Bu model için GPU hızlandırması mevcut değil",
        "contextExceeded": "{{model}} modeli için bağlam uzunluğu aşıldı"
    }
};

export default sectionData;
