const sectionData = {
    "error": {
        "invalidRoutingRules": "Invalid routing rules provided",
        "votingSessionNotFound": "Voting session not found",
        "votingSessionInvalid": "Failed to create a valid voting session",
        "debateSessionNotFound": "Debate session not found",
        "invalidDebateArgument": "Invalid debate argument"
    },
    "voting": {
        "created": "Created voting session: {{question}}",
        "voteSubmitted": "Vote submitted: {{modelId}} voted \"{{decision}}\"",
        "resolved": "Voting resolved: \"{{winner}}\"",
        "deadlocked": "Voting deadlock: {{decisions}}"
    },
    "debate": {
        "created": "Created debate session: {{topic}}",
        "argumentSubmitted": "Argument submitted by {{agentId}}",
        "resolved": "Debate resolved with winning side: {{side}}"
    }
};

export default sectionData;
