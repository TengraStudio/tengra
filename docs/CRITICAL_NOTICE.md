---
trigger: always_on
---

# 🚨 READ BEFORE DOING ANYTHING 🚨

You are in a high-stakes environment. Every decision you make must be justified and safe.

### THE THREE PILLARS OF DEVELOPMENT IN TENGRA:

1.  **TYPE SAFETY OR DEATH**: `any` and `unknown` are your enemies. Use strictly defined interfaces. If you see an `any`, your first job is to hunt it down and replace it.
2.  **THE NASA POWER OF TEN**: Your code must be simple. One function does one thing. If it's over 150 lines, it's broken. If it's too complex, it's dangerous.
3.  **THE BOYSCOUT RULE**: Leave the code cleaner than you found it. Every time you touch a file, fix at least one tiny lint warning or type issue elsewhere in the file.

### UI & COMMUNICATION HARD LOCKS

1.  **CSS-FIRST UI**: All renderer JSX must use semantic classes.
2.  **SINGLE STYLESHEET**: Renderer styles must live only in `src/renderer/index.css`.
3.  **ROOT TOKENS**: Spacing, radius, border, shadow, transition, and typography values must be defined under `:root` in `src/renderer/index.css`.
4.  **NO RULE THEATER**: Never describe which internal rules were followed in final user messages.
5.  **NO NOISE**: Use concise, professional, high-signal language only.

### YOUR IMMEDIATE CHECKS:
- [ ] Am I using path aliases (`@/`)?
- [ ] Did I remove all `console.log`?
- [ ] Is my function under 150 lines?
- [ ] Did I avoid direct Tailwind utility classes in renderer JSX?
- [ ] Did I keep renderer styling inside `src/renderer/index.css` only?
- [ ] Did I run `npm run lint`?
- [ ] Did I run `npm run build` and `npm run type-check`?
- [ ] Did I update the relevant markdown docs if this changes user-facing behavior?
- [ ] Did I COMMIT after completing the TODO or minor change?
- [ ] Are translations only being done on weekends (Saturday-Sunday)?

**IF YOU IGNORE THESE RULES, YOU WILL BE DISCONNECTED.**


