const sectionData = {
    "error": {
        "invalidRoutingRules": "قواعد التوجيه المقدمة غير صالحة",
        "votingSessionNotFound": "لم يتم العثور على جلسة التصويت",
        "votingSessionInvalid": "فشل إنشاء جلسة تصويت صالحة",
        "debateSessionNotFound": "لم يتم العثور على جلسة النقاش",
        "invalidDebateArgument": "حجة نقاش غير صالحة"
    },
    "voting": {
        "created": "تم إنشاء جلسة تصويت: {{question}}",
        "voteSubmitted": "تم إرسال التصويت: {{modelId}} صوّت بـ \"{{decision}}\"",
        "resolved": "تم حل التصويت: \"{{winner}}\"",
        "deadlocked": "تعادل في التصويت: {{decisions}}"
    },
    "debate": {
        "created": "تم إنشاء جلسة نقاش: {{topic}}",
        "argumentSubmitted": "تم تقديم حجة من {{agentId}}",
        "resolved": "تم حل النقاش مع الجانب الفائز: {{side}}"
    }
};

export default sectionData;
