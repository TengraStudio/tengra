const sectionData = {
    "error": {
        "invalidRoutingRules": "Geçersiz yönlendirme kuralları sağlandı",
        "votingSessionNotFound": "Oylama oturumu bulunamadı",
        "votingSessionInvalid": "Geçerli bir oylama oturumu oluşturulamadı",
        "debateSessionNotFound": "Tartışma oturumu bulunamadı",
        "invalidDebateArgument": "Geçersiz tartışma argümanı"
    },
    "voting": {
        "created": "Oylama oturumu oluşturuldu: {{question}}",
        "voteSubmitted": "Oy gönderildi: {{modelId}} \"{{decision}}\" için oy kullandı",
        "resolved": "Oylama sonuçlandı: \"{{winner}}\"",
        "deadlocked": "Oylama kilitlendi: {{decisions}}"
    },
    "debate": {
        "created": "Tartışma oturumu oluşturuldu: {{topic}}",
        "argumentSubmitted": "{{agentId}} tarafından argüman gönderildi",
        "resolved": "Tartışma kazanan taraf ile sonuçlandı: {{side}}"
    }
};

export default sectionData;
