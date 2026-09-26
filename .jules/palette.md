# Palette's Journal - UX & Accessibility Learnings

## 2026-09-26 - Per-Minute Rates Screen Reader Accessibility
**Learning:** Icon-only or compact financial/rate representations (e.g. `<MessageCircle /> $2.50`) in reader cards lack explicit context for screen reader users unless `aria-label` attributes clearly articulate both the modality and rate structure.
**Action:** Always provide descriptive `aria-label` attributes (e.g. `Chat rate: $2.50 per minute`) for rate rows and hide decorative icons with `aria-hidden="true"`.
