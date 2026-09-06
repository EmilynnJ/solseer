🧪 Add tests for boundedJson middleware

🎯 **What:** The `boundedJson` middleware lacked test coverage, specifically around its edge cases and boundary conditions based on the `Content-Length` header.
📊 **Coverage:** A new test suite was added in `apps/worker/test/http.test.ts` that covers: missing `Content-Length` (defaulting to 0), exactly 0, exact boundary limit (65536 bytes), over boundary limit (65537 bytes), invalid length parsing, and ignoring non-JSON payloads.
✨ **Result:** Test coverage for the `boundedJson` middleware boundary behavior is now robust, ensuring that large or malformed requests are properly rejected with a 413 error and valid ones are accepted.
