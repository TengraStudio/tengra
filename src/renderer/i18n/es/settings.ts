const sectionData = {
    "searchPlaceholder": "Buscar configuración...",
    "searchResults": "{count} configuraciones encontradas",
    "noResults": "No se encontró configuración",
    "title": "Configuración",
    "subtitle": "Configura las preferencias de la aplicación.",
    "general": "General",
    "accounts": "Cuentas",
    "models": "Modelos",
    "usage-limits": "Límites de uso",
    "appearance": "Apariencia",
    "speech": "Voz",
    "advanced": "Avanzado",
    "developer": "Desarrollador",
    "statistics": "Estadísticas",
    "gallery": "Galería",
    "about": "Acerca de",
    "personas": "Personas",
    "factoryResetConfirm": "¿Estás seguro de que deseas eliminar todos los datos?",
    "usageLimits": {
        "title": "Límites de uso del modelo",
        "enable": "Habilitar",
        "maxPercentQuota": "Porcentaje máximo de la cuota restante (%)",
        "maxPercentPlaceholder": "50",
        "maxRequests": "Máximo de solicitudes",
        "maxPercentage": "Porcentaje máximo (%)",
        "maxRequestsPlaceholder": "5",
        "maxPercentagePlaceholder": "50",
        "typeLabel": "Tipo:",
        "limitLabel": "Límite {{period}}",
        "percentHint": "Se limitará a {{count}} solicitudes ({{percentage}} % de {{remaining}} restantes)",
        "types": {
            "requests": "Solicitudes",
            "percentage": "Porcentaje"
        },
        "periods": {
            "hourly": "Por hora",
            "daily": "Diario",
            "weekly": "Semanal"
        },
        "copilot": {
            "title": "Copilot",
            "current": "Actual: {{remaining}} / {{limit}} restantes"
        },
        "antigravity": {
            "title": "Modelos Antigravity",
            "description": "Establece un límite porcentual según la cuota restante de cada modelo"
        },
        "codex": {
            "title": "Codex",
            "description": "Establece límites porcentuales según la cuota diaria/semanal restante"
        }
    },
    "browserClosure": {
        "title": "Se requiere cerrar el navegador",
        "description": "Para autenticar con {{provider}}, Tengra necesita leer cookies protegidas.",
        "warningPrefix": "Debemos",
        "warningEmphasis": "cerrar automáticamente tu navegador",
        "warningSuffix": "para liberar el bloqueo de archivos.",
        "saveWork": "Guarda tu trabajo en el navegador antes de continuar. Lo reabriremos de forma invisible para extraer la clave de sesión.",
        "confirm": "Cerrar navegador y conectar"
    },
    "hyperparameters": {
        "title": "Hiperparámetros",
        "temperature": {
            "label": "Temperatura",
            "description": "Nivel de creatividad (0: determinista, 2: muy creativo)"
        },
        "topP": {
            "label": "Top-P",
            "description": "Umbral de probabilidad de nucleus sampling"
        },
        "topK": {
            "label": "Top-K",
            "description": "Número de tokens más probables"
        },
        "repeatPenalty": {
            "label": "Penalización por repetición",
            "description": "Penalización por repetición (1: ninguna, 2: alta)"
        }
    },
    "mcp": {
        "title": "Protocolo de contexto de modelo",
        "subtitle": "Gestiona tus servidores MCP e instala nuevas herramientas",
        "tabs": {
            "servers": "Servidores",
            "marketplace": "Marketplace"
        },
        "servers": {
            "title": "Servidores configurados",
            "subtitle": "Gestiona tus conexiones de servidores MCP",
            "connect": "Conectar servidor",
            "empty": "No hay servidores conectados",
            "emptyHint": "Instalar servidores desde la pestaña Marketplace",
            "enabled": "activado",
            "note": "Nota",
            "noteText": "Los asistentes de IA solo pueden acceder a los servidores habilitados. Cambie el botón de encendido para habilitar/deshabilitar cada servidor.",
            "internalAlwaysEnabled": "Las herramientas internas siempre están habilitadas"
        },
        "status": {
            "connected": "Conectado",
            "disconnected": "Desconectado",
            "error": "Error",
            "enabled": "Activado",
            "disabled": "Desactivado",
            "active": "Activo",
            "inactive": "Inactivo"
        }
    },
    "tabs": {
        "general": "General",
        "appearance": "Apariencia",
        "models": "Modelos",
        "accounts": "Cuentas conectadas",
        "personas": "Personas",
        "speech": "Discurso",
        "statistics": "Estadística",
        "advanced": "Avanzado",
        "developer": "Revelador",
        "about": "Acerca de",
        "images": "Imágenes",
        "mcpServers": "MCP Servidores",
        "accessibility": "Accesibilidad",
        "mcpMarketplace": "MCP Mercado"
    },
    "accessibility": {
        "title": "Accesibilidad",
        "description": "Personaliza tu experiencia para una mejor accesibilidad",
        "highContrast": "Modo de alto contraste",
        "highContrastDesc": "Aumente el contraste para una mejor visibilidad",
        "reducedMotion": "Movimiento reducido",
        "reducedMotionDesc": "Minimizar animaciones y transiciones.",
        "enhancedFocus": "Indicadores de enfoque mejorados",
        "enhancedFocusDesc": "Hacer que los estados de enfoque sean más visibles",
        "screenReader": "Anuncios del lector de pantalla",
        "screenReaderDesc": "Habilitar anuncios para lectores de pantalla",
        "systemPrefs": "Preferencias del sistema",
        "systemPrefsDesc": "Algunas configuraciones detectan automáticamente las preferencias de su sistema. Habilite \"Movimiento reducido\" o \"Alto contraste\" en su sistema operativo para la detección automática.",
        "shortcuts": "Atajos de teclado",
        "tabNav": "Navegar entre elementos",
        "tabNavBack": "Navegar hacia atrás",
        "activate": "Activar elemento enfocado",
        "escape": "Cerrar modal o cancelar",
        "arrowNav": "Navegar dentro de listas"
    },
    "language": "Idioma",
    "theme": "Tema",
    "mcpServers": "MCP Servidores",
    "factoryReset": "Restablecimiento de fábrica",
    "images": {
        "reinstallConfirm": "¿Estás seguro de que deseas reinstalar esta imagen?",
        "title": "Configuración de imagen",
        "description": "Administrar la configuración de generación de imágenes",
        "provider": "Proveedor",
        "localRuntime": "Local Runtime",
        "remoteCloud": "Nube remota",
        "runtimeManagement": "Runtime Gestión",
        "reinstall": "Reinstalar",
        "reinstallHelp": "Reinstale runtime si está dañado",
        "operationsTitle": "Operaciones de imagen",
        "refreshData": "Actualizar datos de imagen",
        "historyTitle": "Historia de la generación",
        "noHistory": "Aún no hay historial de generación de imágenes.",
        "regenerate": "Regenerado",
        "compareSelectionHint": "Seleccione al menos dos entradas del historial para comparar.",
        "compareRun": "Ejecutar comparación",
        "compareClear": "Borrar selección",
        "compareTitle": "Resumen de comparación",
        "presetsTitle": "Presets de generación",
        "noPresets": "Aún no se han guardado ajustes preestablecidos.",
        "presetName": "Nombre preestablecido",
        "promptPrefix": "Prefijo de aviso",
        "savePreset": "Guardar preestablecido",
        "schedulesTitle": "Generaciones programadas",
        "noSchedules": "No hay generaciones programadas.",
        "schedulePrompt": "Programar mensaje",
        "scheduleAt": "Lanzarse sobre",
        "scheduleCreate": "Crear horario",
        "scheduleCancel": "Cancelar programación",
        "queueTitle": "Cola de generación",
        "queueStatus": "Estado de la cola",
        "queueRunning": "Correr",
        "queueIdle": "Inactivo",
        "batchTitle": "Generación por lotes",
        "batchPrompts": "Avisos por lotes",
        "batchRun": "Ejecutar lote",
        "editTitle": "Edición de imágenes",
        "editSource": "Ruta o URL de la imagen de origen",
        "editPrompt": "Editar mensaje",
        "editMode": "Modo de edición",
        "editRun": "Ejecutar Editar"
    }
};

export default sectionData;
