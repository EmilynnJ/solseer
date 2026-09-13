## 2026-09-13 - Modal Close Button Visual Tooltip Consistency
**Learning:** In this application, icon-only buttons (such as in `messages.tsx` and `community.tsx`) pair `aria-label` with matching `title` attributes so desktop mouse users get native hover tooltips while screen readers get clear vocalization.
**Action:** When adding or updating icon-only controls (like `Modal` close buttons), ensure both `aria-label` and `title` attributes are included for consistent visual and screen-reader accessibility.
