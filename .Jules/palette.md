# Palette's Journal - UX & Accessibility Learnings

## 2025-05-18 - Dual Accessible & Hover State Tooltips on Icon-Only Controls
**Learning:** Icon-only controls in this application (e.g. Modal close buttons, conversation refresh triggers, password toggles) provided screen reader `aria-label` accessibility but lacked native desktop hover cues (`title` attribute) for mouse users.
**Action:** When working with icon-only controls, pair `aria-label` with matching `title` attributes (or dynamic titles for toggles) to ensure both screen reader accessible names and desktop hover tooltips are provided simultaneously without adding external heavy UI tooltip dependencies.
