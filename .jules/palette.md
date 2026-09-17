## 2026-09-01 - Icon-Only Button Tooltips & ARIA Labels

**Learning:** In desktop browser environments, icon-only buttons with `aria-label` provide essential accessibility for screen readers, but mouse users benefit from native visual tooltips via `title` attributes when hover context is missing.

**Action:** Whenever implementing icon-only controls (e.g., modal close buttons or action refresh triggers), complement `aria-label` with a matching `title` attribute for dual visual and auditory accessibility.
