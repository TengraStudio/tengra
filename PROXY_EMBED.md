# CLIProxyAPI Embedded Plan

Bu repoda, CLIProxyAPI’yi doğrudan embed edip istediğimiz zaman kodu değiştirebilmek için bir başlangıç yaptım.

## Diziler
- `proxy/cliproxy_embed/`: CLIProxyAPI SDK’yı kullanan minimal Go runner.

## Nasıl çalışır?
1. Go 1.22+ kurulu olmalı.
2. `cd proxy/cliproxy_embed`
3. Bağımlılıkları çekmek için (ilk kez): `go mod tidy`
4. Çalıştır: `go run . -config ../../external/cliproxyapi/config.example.yaml -port 8317`
   - `-config`: CLIProxyAPI config yolu
   - `-port`: istersek override
   - `-health`: `/healthz` endpoint’ini aç/kapat (varsayılan açık)
   - `-auth-store`: encrypted auth store file (single file at rest)
   - `-auth-dir`: working auth directory used for runtime auth files
   - `CLIPROXY_AUTH_KEY`: base64 32-byte key (required when `-auth-store` is used)

Runner, context iptal edilene kadar proxy’yi ayağa kaldırır; Ctrl+C ile kapanır.

## Yerel kaynak kullanımı
`go.mod` içinde `replace github.com/router-for-me/CLIProxyAPI/v6 => ../../external/cliproxyapi` bulunur. Böylece embed build’i doğrudan yerel kaynak kodunu kullanır.

## Neden embed?
- Binary’e mahkûm olmadan config/logik düzeltme ve upstream değişikliklerini hızlıca uygulayabiliriz.
- Programatik config (ileride dosyasız mod) ve healthcheck eklemek kolay.
- Electron main’den doğrudan start/stop/health yönetimi yapılabilir.

## Sonraki adımlar
- Electron IPC’de `proxy:start/stop/status` köprüleri ekleyip bu runner’ı çağırmak veya tek süreçte Go modülünü başlatmak.
- Config’i dosya yerine bellekten besleyen bir helper yazmak.
- Yönetim API’sini kapalı tutup sadece `/healthz` ve proxy uçlarını expose etmek.
- Auth store encryption is enabled; the auth-dir only holds runtime files.
