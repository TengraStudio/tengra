const sectionData = {
    "error": {
        "invalidRoutingRules": "提供的路由规则无效",
        "votingSessionNotFound": "未找到投票会话",
        "votingSessionInvalid": "无法创建有效的投票会话",
        "debateSessionNotFound": "未找到辩论会话",
        "invalidDebateArgument": "无效的辩论论点"
    },
    "voting": {
        "created": "已创建投票会话：{{question}}",
        "voteSubmitted": "已提交投票：{{modelId}}投票\"{{decision}}\"",
        "resolved": "投票已解决：\"{{winner}}\"",
        "deadlocked": "投票僵局：{{decisions}}"
    },
    "debate": {
        "created": "已创建辩论会话：{{topic}}",
        "argumentSubmitted": "{{agentId}}已提交论点",
        "resolved": "辩论已解决，获胜方：{{side}}"
    }
};

export default sectionData;
