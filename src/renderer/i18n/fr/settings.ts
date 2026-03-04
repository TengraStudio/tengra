const sectionData = {
    "searchPlaceholder": "Rechercher dans les paramètres...",
    "searchResults": "{count} paramètres trouvés",
    "noResults": "Aucun paramètre trouvé",
    "title": "Paramètres",
    "subtitle": "Configurez les préférences de l'application.",
    "general": "Général",
    "accounts": "Comptes",
    "models": "Modèles",
    "usage-limits": "Limites d'utilisation",
    "appearance": "Apparence",
    "speech": "Voix",
    "advanced": "Avancé",
    "developer": "Développeur",
    "statistics": "Statistiques",
    "gallery": "Galerie",
    "about": "À propos",
    "personas": "Personas",
    "factoryResetConfirm": "Êtes-vous sûr de vouloir supprimer toutes les données ?",
    "usageLimits": {
        "title": "Limites d'utilisation des modèles",
        "enable": "Activer",
        "maxPercentQuota": "Pourcentage max. de la quota restante (%)",
        "maxPercentPlaceholder": "50",
        "maxRequests": "Nombre max. de requêtes",
        "maxPercentage": "Pourcentage max. (%)",
        "maxRequestsPlaceholder": "5",
        "maxPercentagePlaceholder": "50",
        "typeLabel": "Type :",
        "limitLabel": "Limite {{period}}",
        "percentHint": "Limite à {{count}} requêtes ({{percentage}} % de {{remaining}} restantes)",
        "types": {
            "requests": "Requêtes",
            "percentage": "Pourcentage"
        },
        "periods": {
            "hourly": "Horaire",
            "daily": "Quotidien",
            "weekly": "Hebdomadaire"
        },
        "copilot": {
            "title": "Copilot",
            "current": "Actuel : {{remaining}} / {{limit}} restantes"
        },
        "antigravity": {
            "title": "Modèles Antigravity",
            "description": "Définir un pourcentage basé sur la quota restante de chaque modèle"
        },
        "codex": {
            "title": "Codex",
            "description": "Définir des pourcentages selon la quota quotidienne/hebdomadaire restante"
        }
    },
    "browserClosure": {
        "title": "Fermeture du navigateur requise",
        "description": "Pour s'authentifier avec {{provider}}, Tengra doit lire des cookies protégés.",
        "warningPrefix": "Nous devons",
        "warningEmphasis": "fermer automatiquement votre navigateur",
        "warningSuffix": "pour libérer le verrou de fichier.",
        "saveWork": "Veuillez sauvegarder votre travail dans le navigateur avant de continuer. Nous le rouvrirons invisiblement pour extraire la clé de session.",
        "confirm": "Fermer le navigateur et connecter"
    },
    "hyperparameters": {
        "title": "Hyperparamètres",
        "temperature": {
            "label": "Température",
            "description": "Niveau de créativité (0 : déterministe, 2 : très créatif)"
        },
        "topP": {
            "label": "Top-P",
            "description": "Seuil de probabilité du nucleus sampling"
        },
        "topK": {
            "label": "Top-K",
            "description": "Nombre de tokens les plus probables"
        },
        "repeatPenalty": {
            "label": "Pénalité de répétition",
            "description": "Pénalité de répétition (1 : aucune, 2 : élevée)"
        }
    },
    "mcp": {
        "title": "Protocole de contexte modèle",
        "subtitle": "Gérez vos serveurs MCP et installez de nouveaux outils",
        "tabs": {
            "servers": "Serveurs",
            "marketplace": "Marketplace"
        },
        "servers": {
            "title": "Serveurs configurés",
            "subtitle": "Gérez vos connexions de serveurs MCP",
            "connect": "Connecter un serveur",
            "empty": "Aucun serveur connecté",
            "emptyHint": "Installer les serveurs depuis l'onglet Marketplace",
            "enabled": "activé",
            "note": "Note",
            "noteText": "Seuls les serveurs activés sont accessibles aux assistants IA. Basculez le bouton d'alimentation pour activer/désactiver chaque serveur.",
            "internalAlwaysEnabled": "Les outils internes sont toujours activés"
        },
        "status": {
            "connected": "Connecté",
            "disconnected": "Déconnecté",
            "error": "Erreur",
            "enabled": "Activé",
            "disabled": "Désactivé",
            "active": "Actif",
            "inactive": "Inactif"
        }
    },
    "tabs": {
        "general": "Général",
        "appearance": "Apparence",
        "models": "Modèles",
        "accounts": "Comptes connectés",
        "personas": "Personnages",
        "speech": "Discours",
        "statistics": "Statistiques",
        "advanced": "Avancé",
        "developer": "Promoteur",
        "about": "À propos",
        "images": "Images",
        "mcpServers": "MCP Serveurs",
        "accessibility": "Accessibilité",
        "mcpMarketplace": "MCP Marché"
    },
    "accessibility": {
        "title": "Accessibilité",
        "description": "Personnalisez votre expérience pour une meilleure accessibilité",
        "highContrast": "Mode contraste élevé",
        "highContrastDesc": "Augmentez le contraste pour une meilleure visibilité",
        "reducedMotion": "Mouvement réduit",
        "reducedMotionDesc": "Réduire les animations et les transitions",
        "enhancedFocus": "Indicateurs de mise au point améliorés",
        "enhancedFocusDesc": "Rendre les états de focus plus visibles",
        "screenReader": "Annonces du lecteur d'écran",
        "screenReaderDesc": "Activer les annonces pour les lecteurs d'écran",
        "systemPrefs": "Préférences Système",
        "systemPrefsDesc": "Certains paramètres détectent automatiquement vos préférences système. Activez « Mouvement réduit » ou « Contraste élevé » dans votre système d'exploitation pour une détection automatique.",
        "shortcuts": "Raccourcis clavier",
        "tabNav": "Naviguer entre les éléments",
        "tabNavBack": "Naviguer en arrière",
        "activate": "Activer l'élément ciblé",
        "escape": "Fermer modal ou annuler",
        "arrowNav": "Naviguer dans les listes"
    },
    "language": "Langue",
    "theme": "Thème",
    "mcpServers": "MCP Serveurs",
    "factoryReset": "Réinitialisation d'usine",
    "images": {
        "reinstallConfirm": "Êtes-vous sûr de vouloir réinstaller cette image ?",
        "title": "Paramètres d'image",
        "description": "Gérer les paramètres de génération d'images",
        "provider": "Fournisseur",
        "localRuntime": "Local Runtime",
        "remoteCloud": "Nuage à distance",
        "runtimeManagement": "Runtime Gestion",
        "reinstall": "Réinstaller",
        "reinstallHelp": "Réinstallez le runtime s'il est corrompu",
        "operationsTitle": "Opérations sur les images",
        "refreshData": "Actualiser les données d'image",
        "historyTitle": "Historique des générations",
        "noHistory": "Aucun historique de génération d'images pour l'instant.",
        "regenerate": "Régénérer",
        "compareSelectionHint": "Sélectionnez au moins deux entrées d'historique à comparer.",
        "compareRun": "Exécuter la comparaison",
        "compareClear": "Effacer la sélection",
        "compareTitle": "Résumé de comparaison",
        "presetsTitle": "Préréglages de génération",
        "noPresets": "Aucun préréglage n'a encore été enregistré.",
        "presetName": "Nom du préréglage",
        "promptPrefix": "Préfixe d'invite",
        "savePreset": "Enregistrer le préréglage",
        "schedulesTitle": "Générations planifiées",
        "noSchedules": "Aucune génération planifiée.",
        "schedulePrompt": "Invite de planification",
        "scheduleAt": "Courir à",
        "scheduleCreate": "Créer un calendrier",
        "scheduleCancel": "Annuler le programme",
        "queueTitle": "File d'attente de génération",
        "queueStatus": "Statut de la file d'attente",
        "queueRunning": "En cours d'exécution",
        "queueIdle": "Inactif",
        "batchTitle": "Génération par lots",
        "batchPrompts": "Invites de lots",
        "batchRun": "Exécuter un lot",
        "editTitle": "Édition d'images",
        "editSource": "Chemin ou URL de l'image source",
        "editPrompt": "Modifier l'invite",
        "editMode": "Mode édition",
        "editRun": "Exécuter Modifier"
    }
};

export default sectionData;
