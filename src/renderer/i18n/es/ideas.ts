const sectionData = {
    "title": "Ideas de espacio de trabajo",
    "subtitle": "Generación de ideas de espacio de trabajo asistida por IA con investigación de mercado",
    "newSession": "Nueva sesión",
    "selectModel": "Seleccionar modelo de IA",
    "selectCategories": "Seleccionar categorías",
    "maxIdeas": "Máximo de ideas",
    "startResearch": "Iniciar investigación",
    "startGeneration": "Generar ideas",
    "cancel": "Cancelar",
    "categories": {
        "website": "Sitio web",
        "mobileApp": "Aplicación móvil",
        "game": "Juego",
        "cliTool": "Herramienta CLI",
        "apiBackend": "API / Backend",
        "desktop": "Aplicación de escritorio",
        "other": "Otro"
    },
    "research": {
        "title": "Pipeline de investigación",
        "understanding": "Entendiendo categorías",
        "sectorAnalysis": "Análisis sectorial",
        "marketResearch": "Investigación de mercado",
        "competitorAnalysis": "Análisis de competencia",
        "complete": "Investigación completa"
    },
    "generation": {
        "title": "Generando ideas",
        "progress": "Generando idea {{current}} de {{total}}",
        "enriching": "Enriqueciendo detalles de la idea...",
        "complete": "Generación completa"
    },
    "idea": {
        "viewDetails": "Ver detalles",
        "approve": "Aprobar y crear espacio de trabajo",
        "reject": "Rechazar",
        "nameSuggestions": "Sugerencias de nombre",
        "valueProposition": "Propuesta de valor",
        "competitiveAdvantages": "Ventajas competitivas",
        "marketTrends": "Tendencias del mercado",
        "competitors": "Competidores",
        "selectPath": "Seleccionar ruta del espacio de trabajo",
        "creating": "Creando espacio de trabajo...",
        "detailedDescription": "Descripción detallada",
        "roadmap": "Hoja de ruta del espacio de trabajo",
        "techStack": "Stack tecnológico",
        "competitorAnalysis": "Análisis de competencia",
        "archive": "Archivo",
        "archiving": "Archivando...",
        "pathPlaceholder": "C:\\Espacios de trabajo\\mi-espacio de trabajo",
        "technicalDetails": "Detalles técnicos",
        "impact": "Impacto",
        "impactHigh": "Alto (estimado)",
        "effort": "Esfuerzo",
        "effortMedium": "Medio",
        "openFullWorkspace": "Abrir espacio de trabajo completo"
    },
    "techStack": {
        "frontend": "Frontend",
        "backend": "Backend",
        "database": "Base de datos",
        "infrastructure": "Infraestructura",
        "other": "Otras herramientas"
    },
    "status": {
        "active": "Activo",
        "researching": "Investigando",
        "generating": "Generando",
        "completed": "Completado",
        "cancelled": "Cancelado",
        "pending": "Pendiente",
        "approved": "Aprobado",
        "rejected": "Rechazado",
        "archived": "Archivado"
    },
    "errors": {
        "modelRequired": "Por favor selecciona un modelo",
        "categoriesRequired": "Por favor selecciona al menos una categoría",
        "researchFailed": "Investigación fallida. Por favor intenta de nuevo.",
        "generationFailed": "Generación de ideas fallida. Por favor intenta de nuevo.",
        "approvalFailed": "Error al crear espacio de trabajo. Por favor intenta de nuevo.",
        "logoFailed": "Generación de logo fallida. Por favor intenta de nuevo."
    },
    "empty": {
        "noSessions": "Aún no hay sesiones de ideas",
        "noSessionsDesc": "Inicia una nueva sesión para generar ideas de espacio de trabajo",
        "noIdeas": "Aún no se han generado ideas",
        "noIdeasDesc": "Completa la fase de investigación para generar ideas"
    },
    "history": {
        "title": "Historial de ideas",
        "subtitle": "Explora todas tus sesiones pasadas de generación de ideas",
        "view": "Ver historial",
        "totalSessions": "Sesiones totales",
        "completed": "Completadas",
        "approvedIdeas": "Ideas aprobadas",
        "pendingReview": "Revisión pendiente",
        "viewDetails": "Ver detalles",
        "noIdeasYet": "Aún no se han generado ideas",
        "daysAgo": "hace {{count}} días",
        "ideasCount": "Ideas generadas",
        "ideasSelected": "{{count}} idea(s) seleccionada(s)",
        "clearSelection": "Borrar selección",
        "deleteSelected": "Eliminar seleccionado",
        "activeFilters": "Filtros activos:",
        "clearFilters": "Borrar todo",
        "ideasGenerated": "{{current}} / {{total}} ideas",
        "ideasGeneratedCount": "{{count}} ideas generadas",
        "filter": {
            "searchLabel": "Buscar",
            "statusLabel": "Estado",
            "categoryLabel": "Categoría"
        }
    },
    "modelSelectorHint": "Usa el selector de modelo en la barra superior para cambiar el modelo de IA.",
    "competitor": {
        "strengths": "Fortalezas",
        "weaknesses": "Debilidades",
        "missingFeatures": "Características faltantes",
        "opportunity": "Oportunidad de diferenciación"
    },
    "stages": {
        "seedGeneration": "Generando concepto inicial...",
        "ideaResearch": "Investigando mercado para esta idea...",
        "naming": "Creando sugerencias de nombre...",
        "longDescription": "Escribiendo descripción detallada...",
        "roadmap": "Construyendo hoja de ruta del espacio de trabajo...",
        "techStack": "Seleccionando stack tecnológico...",
        "competitorAnalysis": "Analizando competidores...",
        "finalizing": "Finalizando idea...",
        "complete": "Idea completa"
    },
    "logo": {
        "title": "Generación de logo",
        "generate": "Generar logo",
        "generating": "Generando logo...",
        "requiresAntigravity": "La generación de logo requiere conexión con Antigravity",
        "promptPlaceholder": "Describe tu concepto de logo..."
    },
    "backToSetup": "Volver a la configuración",
    "search": {
        "placeholder": "Buscar ideas por título o descripción..."
    },
    "filter": {
        "allStatuses": "Todos los estados",
        "allCategories": "Todas las categorías",
        "pending": "Pendiente",
        "approved": "Aprobado",
        "rejected": "Rechazado"
    },
    "export": {
        "button": "Exportar",
        "markdown": "Exportar como Markdown",
        "json": "Exportar como JSON"
    },
    "customPrompt": {
        "label": "Requisitos personalizados",
        "optional": "Opcional",
        "placeholder": "por ejemplo, debe utilizar TypeScript, centrarse en la accesibilidad, dirigirse a pequeñas empresas...",
        "hint": "Agregue restricciones o requisitos específicos para que la IA los considere durante la generación de ideas."
    },
    "previewMarket": "Vista previa de la investigación de mercado",
    "marketPreview": {
        "title": "Vista previa de la investigación de mercado",
        "subtitle": "Descripción rápida del mercado para las categorías seleccionadas",
        "loading": "Analizando las condiciones del mercado...",
        "keyTrends": "Tendencias clave",
        "marketSize": "Tamaño del mercado",
        "empty": "No hay datos de vista previa disponibles",
        "continue": "Continuar con la investigación completa"
    },
    "delete": {
        "title": "Eliminar idea",
        "bulkTitle": "Eliminar varias ideas",
        "message": "¿Estás seguro de que quieres eliminar esta idea? Esta acción no se puede deshacer.",
        "bulkMessage": "¿Estás seguro de que deseas eliminar {{count}} ideas? Esta acción no se puede deshacer."
    },
    "details": {
        "tabs": {
            "overview": "Descripción general",
            "market": "Análisis de mercado",
            "strategy": "Estrategia",
            "users": "Perfiles de usuario",
            "business": "Caso de negocio",
            "technology": "Tecnología",
            "roadmap": "Hoja de ruta"
        },
        "statusLabel": "Estado",
        "readyForPilot": "Listo para piloto",
        "workspaceCreated": "Espacio de trabajo creado",
        "workspaceNamePlaceholder": "Nombre del espacio de trabajo",
        "regenerateTitle": "Regenerar esta idea",
        "regenerate": "Regenerado",
        "regenerating": "Regenerante...",
        "deleteTitle": "Eliminar idea",
        "closeTitle": "Cerrar (Esc)",
        "rejectTitle": "¿Rechazar esta idea?",
        "rejectBody": "¿Está seguro de que desea rechazar \"{{title}}\"? Esta acción no se puede deshacer.",
        "rejectReasonLabel": "Motivo (opcional)",
        "rejectReasonPlaceholder": "¿Por qué rechaza esta idea?",
        "rejectAction": "Rechazar idea",
        "rejecting": "Rechazando...",
        "altLabel": "Alt:",
        "targetPersonas": "Personas objetivo",
        "painPoints": "Puntos débiles",
        "userJourney": "Mapa de viaje del usuario",
        "benefitLabel": "Beneficio: {{benefit}}",
        "swot": {
            "title": "Análisis FODA",
            "strengths": "Fortalezas",
            "weaknesses": "Debilidades",
            "opportunities": "Oportunidades",
            "threats": "Amenazas"
        },
        "revenueModel": "Modelo de ingresos",
        "breakEvenStrategy": "Estrategia de equilibrio",
        "costStructure": "Estructura de costos",
        "goToMarket": "Plan de comercialización",
        "first100Users": "Estrategia de los primeros 100 usuarios",
        "researchAssistant": "Asistente de investigación",
        "researchEmpty": "¡Pregúntame cualquier cosa sobre la investigación de mercado, la competencia o la tecnología para esta idea!",
        "researchPlaceholder": "Pregunte sobre competidores, brechas o lógica...",
        "researchError": "Lo siento, no pude comunicarme con el laboratorio de investigación en este momento.",
        "coreConcept": "Concepto central",
        "visualIdentity": "Identidad visual",
        "editDescriptionPlaceholder": "Editar descripción...",
        "categoryAnalysis": "Análisis de categorías",
        "analysisPending": "Análisis pendiente de inmersión profunda..."
    },
    "detailsTitlePlaceholder": "Introduce el título de la idea...",
    "detailsDescriptionPlaceholder": "Introduzca la descripción de la idea..."
};

export default sectionData;
