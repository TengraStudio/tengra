const sectionData = {
    "title": "Veritabanı",
    "subtitle": "Veritabanı yönetimi ve sistem durumu",
    "status": {
        "connected": "Veritabanı bağlı",
        "disconnected": "Veritabanı bağlantısı kesildi",
        "migrating": "Taşıma işlemleri çalışıyor...",
        "error": "Veritabanı hatası",
        "healthy": "Veritabanı sağlıklı"
    },
    "actions": {
        "backup": "Yedek oluştur",
        "restore": "Yedeği geri yükle",
        "optimize": "Veritabanını optimize et",
        "vacuum": "Veritabanını sıkıştır",
        "resetDatabase": "Veritabanını sıfırla",
        "viewStats": "İstatistikleri görüntüle"
    },
    "stats": {
        "totalRecords": "Toplam kayıt: {{count}}",
        "databaseSize": "Veritabanı boyutu: {{size}}",
        "lastBackup": "Son yedekleme: {{date}}",
        "queryCount": "Yürütülen sorgular: {{count}}",
        "avgQueryTime": "Ort. Sorgu Süresi: {{duration}}ms",
        "slowQueries": "Yavaş sorgular: {{count}}"
    },
    "migration": {
        "running": "{{name}} taşıma işlemi çalışıyor...",
        "completed": "{{name}} taşıma işlemi tamamlandı.",
        "failed": "{{name}} taşıma işlemi başarısız oldu.",
        "rollback": "{{name}} taşıma işlemi geri alınıyor...",
        "upToDate": "Veritabanı güncel."
    },
    "confirmation": {
        "resetTitle": "Veritabanını Sıfırla",
        "resetMessage": "Veritabanını sıfırlamak istediğinizden emin misiniz? Bu işlem geri alınamaz.",
        "backupBeforeReset": "Sıfırlamadan önce yedek oluştur"
    }
};

export default sectionData;
