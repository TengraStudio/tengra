const sectionData = {
    "error": {
        "invalidRoutingRules": "Ungültige Routing-Regeln angegeben",
        "votingSessionNotFound": "Abstimmungssitzung nicht gefunden",
        "votingSessionInvalid": "Gültige Abstimmungssitzung konnte nicht erstellt werden",
        "debateSessionNotFound": "Debattensitzung nicht gefunden",
        "invalidDebateArgument": "Ungültiges Debattenargument"
    },
    "voting": {
        "created": "Abstimmungssitzung erstellt: {{question}}",
        "voteSubmitted": "Stimme abgegeben: {{modelId}} hat \"{{decision}}\" gewählt",
        "resolved": "Abstimmung entschieden: \"{{winner}}\"",
        "deadlocked": "Abstimmung blockiert: {{decisions}}"
    },
    "debate": {
        "created": "Debattensitzung erstellt: {{topic}}",
        "argumentSubmitted": "Argument von {{agentId}} eingereicht",
        "resolved": "Debatte mit Gewinnerseite entschieden: {{side}}"
    }
};

export default sectionData;
