const sectionData = {
    "title": "İzleme",
    "subtitle": "Sistem performansı ve sağlık metrikleri",
    "status": {
        "healthy": "Tüm sistemler sağlıklı",
        "degraded": "Performans düşük",
        "critical": "Kritik sorunlar tespit edildi",
        "unknown": "Durum bilinmiyor"
    },
    "metrics": {
        "cpuUsage": "İşlemci Kullanımı",
        "memoryUsage": "Bellek Kullanımı",
        "diskUsage": "Disk Kullanımı",
        "networkLatency": "Ağ Gecikmesi",
        "ipcLatency": "IPC Gecikmesi",
        "uptime": "Çalışma Süresi",
        "responseTime": "Yanıt Süresi",
        "requestsPerSecond": "İstek/sn",
        "errorRate": "Hata Oranı",
        "activeConnections": "Aktif Bağlantılar"
    },
    "actions": {
        "refresh": "Metrikleri Yenile",
        "exportReport": "Rapor Dışa Aktar",
        "clearAlerts": "Uyarıları Temizle",
        "configureAlerts": "Uyarıları Yapılandır",
        "viewHistory": "Geçmişi Görüntüle"
    },
    "alerts": {
        "title": "Uyarılar",
        "noAlerts": "Aktif uyarı yok",
        "critical": "Kritik",
        "warning": "Uyarı",
        "info": "Bilgi",
        "acknowledged": "Uyarı onaylandı"
    },
    "summary": {
        "title": "Performans Özeti",
        "uptimeLabel": "Çalışma süresi: {{duration}}",
        "memoryLabel": "Bellek: {{used}} / {{total}}",
        "avgLatency": "Ortalama Gecikme: {{value}}ms",
        "peakLatency": "En Yüksek Gecikme: {{value}}ms"
    }
};

export default sectionData;
