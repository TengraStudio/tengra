# Antigravity Reverse Engineering Notes

Date: 2026-04-10

## Scope

This note documents the Antigravity-specific findings gathered while validating Tengra's Antigravity integration, quota handling, and AI Credits behavior.

## Source Surfaces

- Installed app bundle:
  - `C:\Users\agnes\AppData\Local\Programs\Antigravity\resources\app\out\main.js`
  - `C:\Users\agnes\AppData\Local\Programs\Antigravity\resources\app\out\jetskiAgent\main.js`
  - `C:\Users\agnes\AppData\Local\Programs\Antigravity\resources\app\out\vs\workbench\workbench.desktop.main.js`
- Tengra native/runtime code:
  - `src/native/tengra-proxy/src/auth/antigravity/client.rs`
  - `src/native/tengra-proxy/src/quota/antigravity.rs`
  - `src/native/tengra-proxy/src/proxy/model_service.rs`
  - `src/main/services/proxy/quota/antigravity-handler.ts`

## Confirmed Endpoints

- OAuth refresh:
  - `https://oauth2.googleapis.com/token`
- User bootstrap / subscription payload:
  - `https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`
- Model and quota payload:
  - `https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels`
- Onboarding:
  - `https://cloudcode-pa.googleapis.com/v1internal:onboardUser`

## AI Credits Findings

- AI Credits are real upstream state, not renderer-only decoration.
- `loadCodeAssist` returns the subscription and credit payload under `paidTier`.
- The relevant structure observed live:

```json
{
  "paidTier": {
    "id": "g1-pro-tier",
    "name": "Google AI Pro",
    "availableCredits": [
      {
        "creditType": "GOOGLE_ONE_AI",
        "creditAmount": "19",
        "minimumCreditAmountForUsage": "50"
      }
    ]
  }
}
```

- `fetchAvailableModels` does not carry the same credit balance payload. It primarily returns per-model quota metadata such as:
  - `remainingFraction`
  - `remainingQuota`
  - `totalQuota`
  - `resetTime`

## Request Shape Findings

- `loadCodeAssist` accepted a very small request body during live probing:

```json
{}
```

- `fetchAvailableModels` accepted:

```json
{}
```

- The model endpoint was stricter than `loadCodeAssist` about request fingerprinting. Generic Google-style request headers produced `403 PERMISSION_DENIED` in live checks, while Antigravity-style request headers succeeded.
- Tengra should not depend on plaintext token copies inside account metadata to reproduce these requests.

## Local Preference Findings

- Antigravity tracks a local credits preference under the unified-state topic `uss-modelCredits`.
- Observed fields in the bundled app:
  - `useAICredits`
  - `availableCredits`
  - `minimumCreditAmountForUsage`
- This preference appears client-local. The balance itself is supplied by `loadCodeAssist`.

## Multi-Account Implications For Tengra

- Antigravity itself appears effectively single-account in its local state model.
- Tengra supports multiple linked Antigravity accounts, so Tengra should treat:
  - credit balance as account-scoped provider data
  - credit usage preference as Tengra account-scoped settings
- Tengra should not rely on one global `useAICredits` switch when multiple Antigravity accounts are linked.
- Tengra's native proxy previously selected an active provider account opportunistically when multiple Antigravity accounts were present.
- Tengra now prefers an explicit `accountId` from request metadata when available and otherwise falls back to the active linked account deterministically instead of picking a random account.

## Security Findings

- Tengra database rows were observed with sensitive token material duplicated into `linked_accounts.metadata`.
- This duplication is unnecessary because encrypted token columns already exist:
  - `access_token`
  - `refresh_token`
  - `session_token`
- Provider metadata should retain safe fields only, for example:
  - `project_id`
  - `tier_id`
  - `email`
  - `quota`
  - other non-secret provider state

## Implementation Decisions Taken

- Tengra now treats `loadCodeAssist` as the source of Antigravity AI Credits.
- Tengra preserves model quota parsing from `fetchAvailableModels`.
- Tengra now scrubs sensitive token fields from linked-account metadata during writes and startup cleanup.
- Tengra now wires account-scoped Antigravity credit confirmation into chat generation and tool-loop follow-up turns when the saved mode is `ask-every-time`.
- Reverse-engineered findings are recorded here so later Antigravity integration work does not need to rediscover the same endpoint behavior.
