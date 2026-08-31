## 2026-08-31 - Modal Close Button Accessibility and Tooltip Support
**Learning:** Icon-only modal close buttons ('×') need clear screen reader accessibility (`aria-label="Close"`) and visible tooltips or title hints for desktop keyboard/mouse interaction.
**Action:** Always verify `Modal` close buttons in `apps/client/src/components/ui.tsx` retain proper `aria-label` and `title` attributes.
