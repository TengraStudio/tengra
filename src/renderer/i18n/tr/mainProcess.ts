const sectionData = {
    "dialog": {
        "windowNotFound": "Pencere bulunamadı",
        "canceled": "İptal edildi",
        "operationFailed": "İletişim kutusu işlemi başarısız oldu",
        "invalidOptionsProvided": "Geçersiz seçenekler sağlandı",
        "saveOperationFailed": "Kaydetme işlemi başarısız oldu"
    },
    "files": {
        "windowNotFound": "Pencere bulunamadı"
    },
    "window": {
        "shellOpenExternal": {
            "accessDenied": "Erişim reddedildi",
            "forbiddenProtocol": "Bu protokole izin verilmiyor",
            "validationFailed": "Doğrulama başarısız oldu"
        },
        "shellRunCommand": {
            "validationFailed": "Komut doğrulaması başarısız oldu",
            "commandTooLong": "Komut çok uzun",
            "tooManyArguments": "Çok fazla argüman var",
            "argumentTooLong": "Argüman çok uzun",
            "invalidArgument": "Geçersiz argüman",
            "executableNotAllowed": "Bu yürütülebilir dosyaya izin verilmiyor",
            "workingDirectoryNotAllowed": "Bu çalışma dizinine izin verilmiyor",
            "argumentPolicyViolation": "Argüman politikası ihlali",
            "rateLimitExceeded": "Hız sınırı aşıldı"
        }
    },
    "notificationService": {
        "notSupported": "Bildirimler desteklenmiyor"
    },
    "clipboardService": {
        "imageNotFound": "Panoda bir görsel bulunmuyor"
    },
    "mcpPlugin": {
        "permissionRequestNotFound": "İzin isteği bulunamadı",
        "pluginNotFound": "'{{pluginName}}' MCP eklentisi bulunamadı.",
        "pluginDisabled": "'{{pluginName}}' eklentisi devre dışı. Ayarlar > MCP bölümünden etkinleştirin.",
        "actionForbiddenForProfile": "'{{actionName}}' işlemi '{{profile}}' profili için yasak. Sunucunun izin profilini Ayarlar'dan değiştirin.",
        "permissionDeniedForAction": "'{{actionName}}' işlemi için izin reddedildi",
        "permissionRequiredForAction": "'{{pluginName}}:{{actionName}}' için izin gerekiyor. MCP ayarlarından onaylayın."
    },
    "webServer": {
        "invalidQuery": "Geçersiz sorgu: boş olmayan bir metin olmalı",
        "queryTooLong": "Sorgu çok uzun (en fazla 500 karakter)",
        "invalidUrlRequired": "Geçersiz URL: boş olmayan bir metin olmalı",
        "invalidUrlProtocol": "Geçersiz URL: yalnızca HTTP/HTTPS protokollerine izin verilir",
        "invalidUrlFormat": "Geçersiz URL biçimi"
    },
    "internetServer": {
        "invalidIpFormat": "Geçersiz IP adresi biçimi (yalnızca IPv4 destekleniyor)",
        "invalidIpOctets": "Geçersiz IP adresi oktetleri",
        "privateIpNotAllowed": "Özel/yerel IP adreslerine izin verilmiyor (SSRF koruması)",
        "invalidTimezoneFormat": "Geçersiz saat dilimi biçimi (Bölge/Konum kullanın, örn. Europe/London)",
        "failedToFetchTopStories": "Öne çıkan haberler alınamadı",
        "invalidCoinOrCurrency": "Geçersiz coin veya para birimi biçimi"
    },
    "networkService": {
        "invalidHostnameOrIp": "Geçersiz ana bilgisayar adı veya IP adresi",
        "invalidDomainName": "Geçersiz alan adı",
        "whoisCommandFailed": "WHOIS komutu başarısız oldu. Yüklü mü?",
        "invalidHost": "Geçersiz ana bilgisayar",
        "websocketStarted": "WebSocket sunucusu {{port}} portunda başlatıldı"
    },
    "sshService": {
        "notConnected": "Bağlı değil",
        "connectionProfileNotFound": "Bağlantı profili bulunamadı",
        "reconnectAttemptsExhausted": "Yeniden bağlanma denemeleri tükendi"
    },
    "chatExportService": {
        "chatNotFound": "Sohbet bulunamadı"
    },
    "extensionService": {
        "pathNotAllowed": "Eklenti yoluna izin verilmiyor",
        "packageJsonNotFound": "package.json bulunamadı",
        "noTengraConfiguration": "package.json içinde tengra yapılandırması bulunamadı",
        "extensionNotFound": "Eklenti bulunamadı",
        "entryPointOutsideRoot": "Eklenti giriş noktası, eklenti kök dizininin dışını işaret ediyor",
        "activateFunctionMissing": "Eklenti modülü bir activate fonksiyonu dışa aktarmalıdır"
    },
    "utilityService": {
        "rateNotFound": "Kur bulunamadı",
        "monitorStarted": "{{url}} izlenmeye başlandı",
        "reminderSet": "{{time}} için hatırlatıcı ayarlandı",
        "reminderCancelled": "Hatırlatıcı iptal edildi",
        "reminderNotFound": "Hatırlatıcı bulunamadı",
        "ghostModeEnabled": "Ghost Modu (DND) etkinleştirildi. Bildirimler susturuldu.",
        "ghostModeDisabled": "Ghost Modu devre dışı bırakıldı.",
        "virusTotalApiKeyRequired": "Argümanlarda veya ayarlarda VirusTotal API anahtarı gerekli",
        "shodanApiKeyRequired": "Shodan API anahtarı gerekli",
        "pluginLoadingDisabled": "Güvenlik nedeniyle eval ile eklenti yükleme devre dışı bırakıldı.",
        "memoryStored": "\"{{key}}\" için bellek kaydedildi (şifreli)",
        "deprecatedIndexDocument": "Kullanımdan kaldırıldı. Dizinleme için CodeIntelligenceService kullanın.",
        "deprecatedSearchDocuments": "Kullanımdan kaldırıldı. Arama için ContextRetrievalService kullanın.",
        "deprecatedScanCodebase": "Kullanımdan kaldırıldı. Tarama için CodeIntelligenceService kullanın."
    }
};

export default sectionData;
