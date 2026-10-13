import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;

if (!posthogKey && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_KEY is configured",
  );
}

if (!posthogHost && import.meta.env.DEV) {
  throw new Error(
    "VITE_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_HOST is configured",
  );
}

if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_exceptions: true,
  });
}

export { posthog };
