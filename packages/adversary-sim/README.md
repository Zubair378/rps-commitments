# Adversary simulations

This package contains only deliberately vulnerable, labelled `INSECURE-DEMO` examples and their protected comparisons. The production server must never import it. `src/index.test.ts` asserts A1–A10 succeed against the vulnerable examples and fail against the defenses. Run `pnpm attacks` to regenerate `docs/results/attacks.json`, or use the browser Attack Lab.
