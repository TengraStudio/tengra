const sectionData = {
    "title": "Nginx Ters Proxy Sihirbazı",
    "subtitle": "Arka uç uygulamanızı bir alan adı üzerinden kolayca yayınlayın.",
    "domain": "Alan Adı",
    "port": "Dahili Port",
    "preview": "Yapılandırmayı önizle",
    "apply": "Uygula ve Nginx'i yeniden yükle",
    "configPreview": "Yapılandırma Önizlemesi",
    "placeholders": {
        "domain": "api.benimuygulamam.com",
        "port": "3000"
    },
    "status": {
        "domainRequired": "Alan adı gereklidir",
        "connecting": "Sunucuya bağlanılıyor...",
        "moving": "Yapılandırma Nginx dizinine taşınıyor...",
        "success": "Nginx başarıyla yeniden yüklendi!",
        "error": "Yapılandırma uygulanamadı: {{error}}. Sudo yetkinizin olduğundan emin olun."
    }
};

export default sectionData;
