import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST;
const configured = Boolean(posthogKey && posthogHost);

if (!configured) {
  // A missing analytics key must not prevent the app or registration loading.
  console.warn("SoulSeer analytics is not configured (VITE_POSTHOG_KEY/HOST).");
}

if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    opt_out_capturing_by_default: true,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_session_recording: true,
  });
}

let analyticsAllowed = false;

export function setPostHogConsent(allowed: boolean) {
  if (!configured || analyticsAllowed === allowed) return;
  analyticsAllowed = allowed;
  try {
    if (allowed) posthog.opt_in_capturing();
    else posthog.opt_out_capturing();
  } catch {
    // Optional analytics must not interrupt essential app functionality.
  }
}

type AuthEvent = "auth_signup_attempt" | "auth_signup_created" | "auth_signin_attempt" | "auth_signin_success" | "auth_verification_requested" | "auth_profile_completed" | "auth_flow_failed";

export function captureAuthEvent(event: AuthEvent, identityId?: string, stage?: string) {
  if (!configured || !analyticsAllowed) return;
  try {
    if (identityId) posthog.identify(identityId);
    posthog.capture(event, stage ? { stage } : {});
  } catch {
    // This is product analytics, never the authoritative security audit.
  }
}

export function identifyAnalyticsUser(id: string) {
  if (!configured || !analyticsAllowed) return;
  try { posthog.identify(id); } catch { /* optional analytics */ }
}

export function resetAnalyticsUser() {
  if (!configured || !analyticsAllowed) return;
  try { posthog.reset(); } catch { /* optional analytics */ }
}

export { posthog };
