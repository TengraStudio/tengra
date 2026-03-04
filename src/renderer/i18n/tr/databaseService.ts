const sectionData = {
    "title": "Veritabanı",
    "subtitle": "Veritabanı yönetimi ve sağlık durumu",
    "status": {
        "connected": "Veritabanı bağlı",
        "disconnected": "Veritabanı bağlantısı kesildi",
        "migrating": "Taşıma işlemleri çalışıyor...",
        "error": "Veritabanı hatası",
        "healthy": "Veritabanı sağlıklı"
    },
    "actions": {
        "backup": "Yedek Oluştur",
        "restore": "Yedeği Geri Yükle",
        "optimize": "Veritabanını Optimize Et",
        "vacuum": "Veritabanını Sıkıştır",
        "resetDatabase": "Veritabanını Sıfırla",
        "viewStats": "İstatistikleri Görüntüle"
    },
    "stats": {
        "totalRecords": "Toplam Kayıt: {{count}}",
        "databaseSize": "Veritabanı Boyutu: {{size}}",
        "lastBackup": "Son Yedekleme: {{date}}",
        "queryCount": "Yürütülen Sorgular: {{count}}",
        "avgQueryTime": "Ort. Sorgu Süresi: {{duration}}ms",
        "slowQueries": "Yavaş Sorgular: {{count}}"
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
