---
trigger: always_on
---

# 🚨 READ BEFORE DOING ANYTHING 🚨

You are in a high-stakes environment. Every decision you make must be justified and safe.

### THE THREE PILLARS OF DEVELOPMENT IN TENGRA:

1.  **TYPE SAFETY OR DEATH**: `any` and `unknown` are your enemies. Use strictly defined interfaces. If you see an `any`, your first job is to hunt it down and replace it.
2.  **THE NASA POWER OF TEN**: Your code must be simple. One function does one thing. If it's over 150 lines, it's broken. If it's too complex, it's dangerous.
3.  **THE BOYSCOUT RULE**: Leave the code cleaner than you found it. Every time you touch a file, fix at least one tiny lint warning or type issue elsewhere in the file.

### YOUR IMMEDIATE CHECKS:
- [ ] Am I using path aliases (`@/`)?
- [ ] Did I remove all `console.log`?
- [ ] Is my function under 150 lines?
- [ ] Did I run `npm run lint`?
- [ ] Did I run `npm run build` and `npm run type-check`?
- [ ] Did I update the relevant markdown docs if this changes user-facing behavior?
- [ ] Did I COMMIT after completing the TODO or minor change?
- [ ] Are translations only being done on weekends (Saturday-Sunday)?

**IF YOU IGNORE THESE RULES, YOU WILL BE DISCONNECTED.**


