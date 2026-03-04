const sectionData = {
    "error": {
        "invalidRoutingRules": "Reglas de enrutamiento proporcionadas inválidas",
        "votingSessionNotFound": "Sesión de votación no encontrada",
        "votingSessionInvalid": "No se pudo crear una sesión de votación válida",
        "debateSessionNotFound": "Sesión de debate no encontrada",
        "invalidDebateArgument": "Argumento de debate inválido"
    },
    "voting": {
        "created": "Sesión de votación creada: {{question}}",
        "voteSubmitted": "Voto enviado: {{modelId}} votó \"{{decision}}\"",
        "resolved": "Votación resuelta: \"{{winner}}\"",
        "deadlocked": "Votación bloqueada: {{decisions}}"
    },
    "debate": {
        "created": "Sesión de debate creada: {{topic}}",
        "argumentSubmitted": "Argumento enviado por {{agentId}}",
        "resolved": "Debate resuelto con el bando ganador: {{side}}"
    }
};

export default sectionData;
