const sectionData = {
    "title": "Görüntü Oluşturma",
    "description": "Yerel ve uzak görüntü oluşturma sağlayıcılarını yapılandırın.",
    "provider": "Oluşturma Sağlayıcısı",
    "localRuntime": "Yerel Çalışma Zamanı",
    "remoteCloud": "Uzak Bulut Sağlayıcısı",
    "runtimeManagement": "Çalışma Zamanı Yönetimi",
    "antigravity": "Antigravity (Uzak)",
    "pollinations": "Pollinations (Uzak)",
    "sdCpp": "stable-diffusion.cpp (Yerel)",
    "ollama": "Ollama (Yerel)",
    "sdWebUI": "Stable Diffusion WebUI",
    "comfyUI": "ComfyUI",
    "binaryPath": "Yürütülebilir Dosya Yolu",
    "modelPath": "Model Yolu",
    "extraArgs": "Ek CLI Argümanları",
    "runtimeStatus": "Çalışma Zamanı Durumu",
    "statusLabel": "Durum",
    "status": {
        "checking": "Durum Kontrol Ediliyor...",
        "ready": "Hazır",
        "installing": "Yükleniyor...",
        "failed": "Başarısız",
        "notConfigured": "Yapılandırılmadı"
    },
    "reinstall": "Yeniden Yükle / Onar",
    "reinstallConfirm": "SD-CPP çalışma zamanını yeniden yüklemek istediğinizden emin misiniz? Bu işlem ikili dosyayı ve varsayılan modeli tekrar indirecektir.",
    "reinstallHelp": "Görüntü oluşturucu takılırsa veya hata verirse, yeniden yükleme genellikle bozuk dosyaları düzeltir.",
    "downloading": "İndiriliyor...",
    "progress": "{{downloaded}} / {{total}} indirildi",
    "pathHint": "AppData içindeki varsayılan konumları kullanmak için boş bırakın.",
    "ollamaMessages": {
        "serviceUnavailable": "Ollama servisine şu anda ulaşılamıyor."
    },
    "ollamaStartup": {
        "alreadyRunning": "Ollama zaten çalışıyor.",
        "notInstalled": "Ollama yüklü değil. Lütfen https://ollama.com adresinden indirin.",
        "userDeclined": "Ollama başlatma işlemi iptal edildi.",
        "startFailed": "Ollama başlatılamadı.",
        "started": "Ollama başlatıldı.",
        "manualStartRequired": "Ollama başlatılamadı. Lütfen manuel olarak başlatın.",
        "unexpected": "Ollama başlatma hatası: {{reason}}"
    },
    "runtimeHealth": {
        "noProbe": "{{componentId}} için harici bağımlılık denetimi kayıtlı değil.",
        "unsupportedTarget": "Bu platform için uyumlu çalışma zamanı hedefi bulunamadı.",
        "installPathMissing": "Bu bileşen için kurulum yolu çözümlenemedi.",
        "fileMissing": "Çalışma zamanı dosyası eksik.",
        "notExecutable": "Çalışma zamanı dosyası yürütülebilir değil.",
        "fileReady": "Çalışma zamanı dosyası hazır.",
        "ollama": {
            "notInstalled": "Ollama yüklü değil.",
            "notRunning": "Ollama yüklü ancak çalışmıyor.",
            "running": "Ollama yüklü ve çalışıyor."
        }
    }
};

export default sectionData;
