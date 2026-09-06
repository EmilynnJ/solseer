## 2026-09-06 - Test boundedJson middleware
**Learning:** Testing Hono middlewares that throw custom errors (like `AppError`) requires setting up an `.onError` handler on the test `Hono` app instance to catch and serialize the error, otherwise the test framework might just see a 500 error or unhandled promise rejection.
**Action:** When testing middleware that throws custom errors, include an error handler in the test app setup.
