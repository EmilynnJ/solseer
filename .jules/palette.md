## 2026-08-23 - Modal Keyboard Accessibility and Focus Management
**Learning:** Standard modal dialogs require keydown listeners for Escape key dismissal and explicit focus management on mount. Decoupling focus-on-mount into a separate effect with empty `[]` dependencies prevents stealing focus from nested active form controls when parent components re-render.
**Action:** Always implement keydown Escape handlers and single-execution focus management when building or modifying dialog components.
