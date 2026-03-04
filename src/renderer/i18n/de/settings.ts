const sectionData = {
    "searchPlaceholder": "Einstellungen suchen...",
    "searchResults": "{count} passende Einstellungen gefunden",
    "noResults": "Keine Einstellungen gefunden",
    "title": "Einstellungen",
    "subtitle": "Anwendungseinstellungen konfigurieren.",
    "general": "Allgemein",
    "accounts": "Konten",
    "models": "Modelle",
    "usage-limits": "Nutzungslimits",
    "appearance": "Erscheinungsbild",
    "speech": "Sprache",
    "advanced": "Erweitert",
    "developer": "Entwickler",
    "statistics": "Statistiken",
    "gallery": "Galerie",
    "about": "Über",
    "personas": "Personas",
    "factoryResetConfirm": "Sind Sie sicher, dass Sie alle Daten löschen möchten?",
    "usageLimits": {
        "title": "Nutzungslimits für Modelle",
        "enable": "Aktivieren",
        "maxPercentQuota": "Max. Prozentsatz der verbleibenden Quote (%)",
        "maxPercentPlaceholder": "50",
        "maxRequests": "Max. Anfragen",
        "maxPercentage": "Max. Prozentsatz (%)",
        "maxRequestsPlaceholder": "5",
        "maxPercentagePlaceholder": "50",
        "typeLabel": "Typ:",
        "limitLabel": "{{period}}-Limit",
        "percentHint": "Wird auf {{count}} Anfragen begrenzt ({{percentage}} % von {{remaining}} verbleibend)",
        "types": {
            "requests": "Anfragen",
            "percentage": "Prozent"
        },
        "periods": {
            "hourly": "Stündlich",
            "daily": "Täglich",
            "weekly": "Wöchentlich"
        },
        "copilot": {
            "title": "Copilot",
            "current": "Aktuell: {{remaining}} / {{limit}} verbleibend"
        },
        "antigravity": {
            "title": "Antigravity-Modelle",
            "description": "Prozentsatzlimit basierend auf der verbleibenden Quote je Modell festlegen"
        },
        "codex": {
            "title": "Codex",
            "description": "Prozentsatzlimits basierend auf täglicher/wöchentlicher Restquote festlegen"
        }
    },
    "browserClosure": {
        "title": "Browser muss geschlossen werden",
        "description": "Zur Authentifizierung mit {{provider}} muss Tengra geschützte Cookies lesen.",
        "warningPrefix": "Wir müssen",
        "warningEmphasis": "Ihren Browser automatisch schließen",
        "warningSuffix": "um die Dateisperre zu lösen.",
        "saveWork": "Bitte speichern Sie Ihre Arbeit im Browser, bevor Sie fortfahren. Wir öffnen ihn unsichtbar erneut, um den Sitzungsschlüssel zu extrahieren.",
        "confirm": "Browser schließen & verbinden"
    },
    "hyperparameters": {
        "title": "Hyperparameter",
        "temperature": {
            "label": "Temperatur",
            "description": "Kreativitätsgrad (0: deterministisch, 2: sehr kreativ)"
        },
        "topP": {
            "label": "Top-P",
            "description": "Schwelle der Nucleus-Sampling-Wahrscheinlichkeit"
        },
        "topK": {
            "label": "Top-K",
            "description": "Anzahl der wahrscheinlichsten Tokens"
        },
        "repeatPenalty": {
            "label": "Wiederholungsstrafe",
            "description": "Wiederholungsstrafe (1: keine, 2: hoch)"
        }
    },
    "mcp": {
        "title": "Model Context Protocol",
        "subtitle": "MCP-Server verwalten und neue Tools installieren",
        "tabs": {
            "servers": "Server",
            "marketplace": "Marketplace"
        },
        "servers": {
            "title": "Konfigurierte Server",
            "subtitle": "Verwalten Sie Ihre Model-Context-Protocol-Serververbindungen",
            "connect": "Server verbinden",
            "empty": "Keine Server verbunden",
            "emptyHint": "Installieren Sie Server über die Registerkarte „Marktplatz“.",
            "enabled": "ermöglicht",
            "note": "Notiz",
            "noteText": "Für KI-Assistenten sind nur aktivierte Server zugänglich. Betätigen Sie den Netzschalter, um jeden Server zu aktivieren/deaktivieren.",
            "internalAlwaysEnabled": "Interne Tools sind immer aktiviert"
        },
        "status": {
            "connected": "Verbunden",
            "disconnected": "Getrennt",
            "error": "Fehler",
            "enabled": "Ermöglicht",
            "disabled": "Deaktiviert",
            "active": "Aktiv",
            "inactive": "Inaktiv"
        }
    },
    "tabs": {
        "general": "Allgemein",
        "appearance": "Aussehen",
        "models": "Modelle",
        "accounts": "Verbundene Konten",
        "personas": "Personas",
        "speech": "Rede",
        "statistics": "Statistiken",
        "advanced": "Fortschrittlich",
        "developer": "Entwickler",
        "about": "Um",
        "images": "Bilder",
        "mcpServers": "MCP Server",
        "accessibility": "Zugänglichkeit",
        "mcpMarketplace": "MCP Marktplatz"
    },
    "accessibility": {
        "title": "Zugänglichkeit",
        "description": "Passen Sie Ihr Erlebnis für eine bessere Zugänglichkeit an",
        "highContrast": "Hochkontrastmodus",
        "highContrastDesc": "Erhöhen Sie den Kontrast für eine bessere Sichtbarkeit",
        "reducedMotion": "Reduzierte Bewegung",
        "reducedMotionDesc": "Minimieren Sie Animationen und Übergänge",
        "enhancedFocus": "Verbesserte Fokusindikatoren",
        "enhancedFocusDesc": "Machen Sie Fokuszustände besser sichtbar",
        "screenReader": "Ankündigungen zum Screenreader",
        "screenReaderDesc": "Aktivieren Sie Ankündigungen für Screenreader",
        "systemPrefs": "Systemeinstellungen",
        "systemPrefsDesc": "Einige Einstellungen erkennen Ihre Systemeinstellungen automatisch. Aktivieren Sie „Reduzierte Bewegung“ oder „Hoher Kontrast“ in Ihrem Betriebssystem für die automatische Erkennung.",
        "shortcuts": "Tastaturkürzel",
        "tabNav": "Navigieren Sie zwischen Elementen",
        "tabNavBack": "Navigieren Sie rückwärts",
        "activate": "Fokussiertes Element aktivieren",
        "escape": "Modal schließen oder abbrechen",
        "arrowNav": "Navigieren Sie innerhalb von Listen"
    },
    "language": "Sprache",
    "theme": "Thema",
    "mcpServers": "MCP Server",
    "factoryReset": "Werksreset",
    "images": {
        "reinstallConfirm": "Sind Sie sicher, dass Sie dieses Image erneut installieren möchten?",
        "title": "Bildeinstellungen",
        "description": "Verwalten Sie die Einstellungen für die Bildgenerierung",
        "provider": "Anbieter",
        "localRuntime": "Lokal Runtime",
        "remoteCloud": "Remote-Cloud",
        "runtimeManagement": "Runtime Verwaltung",
        "reinstall": "Neu installieren",
        "reinstallHelp": "Installieren Sie runtime neu, falls es beschädigt ist",
        "operationsTitle": "Bildoperationen",
        "refreshData": "Bilddaten aktualisieren",
        "historyTitle": "Generationengeschichte",
        "noHistory": "Noch kein Bildgenerierungsverlauf.",
        "regenerate": "Regenerieren",
        "compareSelectionHint": "Wählen Sie mindestens zwei Verlaufseinträge zum Vergleich aus.",
        "compareRun": "Vergleich durchführen",
        "compareClear": "Auswahl löschen",
        "compareTitle": "Vergleichszusammenfassung",
        "presetsTitle": "Generationsvoreinstellungen",
        "noPresets": "Noch keine Voreinstellungen gespeichert.",
        "presetName": "Name der Voreinstellung",
        "promptPrefix": "Eingabeaufforderungspräfix",
        "savePreset": "Voreinstellung speichern",
        "schedulesTitle": "Geplante Generationen",
        "noSchedules": "Keine geplanten Generationen.",
        "schedulePrompt": "Terminaufforderung",
        "scheduleAt": "Laufen Sie bei",
        "scheduleCreate": "Zeitplan erstellen",
        "scheduleCancel": "Zeitplan abbrechen",
        "queueTitle": "Generationswarteschlange",
        "queueStatus": "Warteschlangenstatus",
        "queueRunning": "Läuft",
        "queueIdle": "Leerlauf",
        "batchTitle": "Batch-Generierung",
        "batchPrompts": "Batch-Eingabeaufforderungen",
        "batchRun": "Stapel ausführen",
        "editTitle": "Bildbearbeitung",
        "editSource": "Quellbildpfad oder URL",
        "editPrompt": "Eingabeaufforderung bearbeiten",
        "editMode": "Bearbeitungsmodus",
        "editRun": "Führen Sie Bearbeiten aus"
    }
};

export default sectionData;
