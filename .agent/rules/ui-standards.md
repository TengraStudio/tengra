# TENGRA UI STANDARDS

STRICT ADHERENCE MANDATORY.

## 1. DESIGN PHILOSOPHY
- **Aesthetics**: Cyber-Premium. Glassmorphism, Atmospheric Lighting, Tactical HUD.
- **Tone**: Sophisticated, Minimal, Authoritative.

## 2. TYPOGRAPHY (CRITICAL)
- **Forbidden Classes**: 
    - `text-[...]` (Ad-hoc sizes)
    - `tracking-...` (Ad-hoc tracking)
    - `italic` (Forbidden in HUD/UI)
    - `font-black` (Use `font-bold` instead)
- **Mandatory Usage**:
    - Use Semantic Classes: `.typo-overline`, `.typo-caption`, `.typo-body-sm`.
    - Use Tokens: `text-10`, `tracking-tight`.

## 3. COLOR SYSTEM
- **Tokens**: MUST use `hsl(var(--...))` variables.
- **Primary**: `hsl(var(--primary))`
- **Accent**: Atmospheric glows using `hsl(var(--...)/40%)`.

## 4. COMPONENTS
- Functional only. Max 100 lines.
- No ad-hoc spacing. Use Tailwind spacing scale.
