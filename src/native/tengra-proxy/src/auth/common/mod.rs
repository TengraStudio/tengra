/*
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

pub fn close_window_html() -> axum::response::Html<&'static str> {
    axum::response::Html(
        r#"
        <!DOCTYPE html>
        <html>
        <head>
            <title>Giriş Başarılı</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f2f5; }
                .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
                h1 { color: #1a73e8; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Giriş Başarılı!</h1>
                <p>Uygulama onay kodunu aldı. Bu pencere otomatik kapanacaktır.</p>
                <script>
                    setTimeout(() => { window.close(); }, 2000);
                </script>
            </div>
        </body>
        </html>
    "#,
    )
}
