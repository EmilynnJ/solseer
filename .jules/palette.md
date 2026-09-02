## 2026-09-02 - Pair ARIA labels with native title attributes on icon-only controls
**Learning:** Icon-only buttons (such as Modal close buttons, refresh icons, show/hide password toggles, and mobile navigation controls) provide necessary screen reader accessibility via `aria-label`, but desktop mouse users benefit greatly from visible hover tooltips provided by matching `title` attributes.
**Action:** Always combine `aria-label` with a matching `title` attribute when creating or updating icon-only interactive elements in the client app.
