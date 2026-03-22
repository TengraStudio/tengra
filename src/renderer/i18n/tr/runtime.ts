const sectionData = {
    "managementTitle": "Çalışma zamanı yönetimi",
    "statusTitle": "Çalışma zamanı durumu",
    "repairAction": "Onar / yeniden kur",
    "installAction": "Kur",
    "startAction": "Başlat",
    "status": {
        "ready": "Hazır",
        "notConfigured": "Yapılandırılmadı",
        "failed": "Başarısız"
    },
    "health": {
        "noProbe": "{{componentId}} için bağımlılık sağlık kontrolü tanımlı değil.",
        "unsupportedTarget": "Bu platform için uyumlu çalışma zamanı hedefi bulunamadı.",
        "installPathMissing": "Bu bileşen için kurulum yolu belirlenemedi.",
        "fileMissing": "Çalışma zamanı dosyası eksik.",
        "notExecutable": "Çalışma zamanı dosyası çalıştırılamıyor.",
        "fileReady": "Çalışma zamanı dosyası hazır.",
        "ollama": {
            "notInstalled": "Ollama yüklü değil.",
            "notRunning": "Ollama yüklü ancak çalışmıyor.",
            "running": "Ollama yüklü ve çalışıyor."
        }
    }
};

export default sectionData;
