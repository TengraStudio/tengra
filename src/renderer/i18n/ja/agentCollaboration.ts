const sectionData = {
    "error": {
        "invalidRoutingRules": "無効なルーティングルールが指定されました",
        "votingSessionNotFound": "投票セッションが見つかりません",
        "votingSessionInvalid": "有効な投票セッションを作成できませんでした",
        "debateSessionNotFound": "ディベートセッションが見つかりません",
        "invalidDebateArgument": "無効なディベート引数"
    },
    "voting": {
        "created": "投票セッションを作成しました: {{question}}",
        "voteSubmitted": "投票が送信されました: {{modelId}}が\"{{decision}}\"に投票",
        "resolved": "投票が解決しました: \"{{winner}}\"",
        "deadlocked": "投票がデッドロック: {{decisions}}"
    },
    "debate": {
        "created": "ディベートセッションを作成しました: {{topic}}",
        "argumentSubmitted": "{{agentId}}から引数が送信されました",
        "resolved": "ディベートが勝者側で解決しました: {{side}}"
    }
};

export default sectionData;
