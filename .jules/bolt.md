## 2026-08-16 - Deferred Image Loading and Async Decoding for Grid Items

**Learning:** Adding `loading="lazy"` and `decoding="async"` to repeated portrait images in component lists (`ReaderCard`) defers off-screen image fetching until near viewport and offloads image decoding from the main thread, lowering network contention and initial DOM render costs.

**Action:** Always check list components and card grid templates for `<img>` tags that can benefit from `loading="lazy"` and `decoding="async"`.
