const sectionData = {
    "error": {
        "invalidRoutingRules": "Règles de routage fournies invalides",
        "votingSessionNotFound": "Session de vote non trouvée",
        "votingSessionInvalid": "Impossible de créer une session de vote valide",
        "debateSessionNotFound": "Session de débat non trouvée",
        "invalidDebateArgument": "Argument de débat invalide"
    },
    "voting": {
        "created": "Session de vote créée : {{question}}",
        "voteSubmitted": "Vote soumis : {{modelId}} a voté \"{{decision}}\"",
        "resolved": "Vote résolu : \"{{winner}}\"",
        "deadlocked": "Vote bloqué : {{decisions}}"
    },
    "debate": {
        "created": "Session de débat créée : {{topic}}",
        "argumentSubmitted": "Argument soumis par {{agentId}}",
        "resolved": "Débat résolu avec le camp gagnant : {{side}}"
    }
};

export default sectionData;
