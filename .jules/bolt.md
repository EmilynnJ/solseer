## 2026-09-11 - Lazy load images below the fold
**Learning:** Initial page loads can be bogged down by fetching images that aren't even on the screen yet, delaying the LCP for critical resources.
**Action:** When working on lists or elements below the fold, always add `loading="lazy"` to `<img>` tags. Note: This shouldn't be added to hero images or images above the fold because it delays the browser's preload scanner and worsens the LCP.
