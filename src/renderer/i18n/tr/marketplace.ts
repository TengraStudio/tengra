const marketplace = {
    "title": "Mağaza",
    "subtitle": "Yapay zeka olanaklarınızı genişletin",
    "tabs": {
        "mcp": "MCP Modülleri",
        "themes": "Görsel Temalar",
        "personas": "Ajan Kişilikleri",
        "models": "Yapay Zeka Modelleri",
        "prompts": "Prompt Kütüphanesi"
    },
    "mcp": {
        "title": "Model Bağlam Protokolü",
        "description": "Asistanınız için güçlü, güvenli ve genişletilebilir arayüzler. Sisteminize, ağınıza ve araçlarınıza tutarlılıkla bağlanın.",
        "search": "Modüllerde ara...",
        "filters": {
            "all": "Hepsi",
            "core": "Dahili",
            "user": "Dış",
            "store": "Mağaza"
        },
        "sections": {
            "themes": "Görsel Temalar",
            "mcp": "Popüler Modüller"
        },
        "stats": {
            "active": "Aktif",
            "inactive": "Beklemede",
            "builtin": "Dahili Çekirdek",
            "local": "Yerel Eklenti",
            "tools": "Kullanılabilir Araçlar",
            "modules_found": "Modül Bulundu"
        },
        "plugins": {
            "filesystem": {
                "description": "Dosya okuma, yazma, listeleme ve yönetim araçları (zip, indirme vb. dahil)"
            },
            "command": {
                "description": "Güvenlik kontrolleri ile yerel terminal komutu çalıştırma sistemi"
            },
            "system": {
                "description": "Donanım kaynakları, CPU/bellek kullanımı ve sistem durumu izleme araçları"
            },
            "network": {
                "description": "Ağ tanılama, DNS sorgulama ve bağlantı kontrol araçları"
            },
            "workspace": {
                "description": "Proje dosyaları ve çalışma alanı yönetimi araçları"
            },
            "docker": {
                "description": "Docker konteynerleri, imajları ve durum izleme araçları"
            },
            "git": {
                "description": "Versiyon kontrolü, commit ve repo yönetim araçları"
            },
            "web": {
                "description": "İnternet üzerinden veri çekme ve sayfa içeriği analiz araçları"
            },
            "weather": {
                "description": "wttr.in üzerinden güncel hava durumu ve tahmin bilgileri"
            },
            "ollama": {
                "description": "Yerel Ollama modellerini listeleme ve yönetim araçları"
            }
        },
        "actions": {
            "detail": "Detayları İncele",
            "toggle": "Modülü Aç/Kapat",
            "uninstall": "Modülü Kaldır",
            "uninstall_check": "{name} modülünü kaldırmak istediğinize emin misiniz?",
            "install": "Yeni Modül Yükle"
        },
        "empty": {
            "title": "Modül Bulunamadı",
            "subtitle": "Kriterlerinize uygun herhangi bir MCP sunucusu bulunamadı. Aramanızı düzeltmeyi veya yeni bir modül yüklemeyi deneyin.",
            "reset": "Filtreleri Temizle"
        },
        "labels": {
            "version": "v{version}",
            "author": "{author} tarafından",
            "status": "Sistem Durumu",
            "all_modules": "Tüm Modüller"
        },
        "placeholders": {
            "empty": "Henüz modül yüklenmemiş. Yeni bir tane ekleyerek başlayın."
        }
    },
    "placeholders": {
        "soon": {
            "title": "{tab} Yakında",
            "description": "'{tab}' ekosistemini titizlikle hazırlıyoruz. Bu özellik şu anda geliştirme aşamasındadır.",
            "button": "Haberdar Et"
        }
    }
};

export default marketplace;
