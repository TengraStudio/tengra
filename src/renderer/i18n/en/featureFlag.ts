const sectionData = {
    "enabled": "Feature enabled: {{featureId}}.",
    "disabled": "Feature disabled: {{featureId}}.",
    "notFound": "Feature flag \"{{featureId}}\" not found",
    "evaluationFailed": "Feature flag evaluation failed. Defaulting to disabled.",
    "overrideSet": "Override set for {{featureId}}: {{value}}.",
    "overrideCleared": "Override cleared for {{featureId}}.",
    "flagsLoaded": "Feature flags loaded.",
    "loadFailed": "Failed to load feature flags.",
    "saveFailed": "Failed to save feature flags.",
    "error": {
        "invalidId": "Feature flag ID must be a non-empty string",
        "blankId": "Feature flag ID must not be blank",
        "idTooLong": "Feature flag ID exceeds maximum length of {{maxLength}}",
        "invalidIdChars": "Feature flag ID contains invalid characters",
        "invalidContext": "Evaluation context must be a plain object",
        "invalidOverride": "Override value must be a boolean",
        "fieldEmpty": "{{fieldName}} must be a non-empty string",
        "fieldTooLong": "{{fieldName}} exceeds maximum length of {{maxLength}}",
        "attributesNotObject": "Attributes must be a plain object",
        "attributesTooMany": "Attributes exceed the maximum of {{maxCount}} entries",
        "attributeInvalidType": "Attribute \"{{key}}\" must be string, number, or boolean",
        "attributeTooLong": "Attribute \"{{key}}\" exceeds maximum length of {{maxLength}}"
    }
};

export default sectionData;
