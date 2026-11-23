// Letter: calls made before the tag in index.html has loaded are queued for it.
type LetterCall = ((command: string, ...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    lettervisit?: LetterCall;
  }
}

export function letter(command: string, ...args: unknown[]) {
  try {
    const queue: LetterCall = function (...queued: unknown[]) {
      (queue.q = queue.q ?? []).push(queued);
    };
    window.lettervisit = window.lettervisit ?? queue;
    window.lettervisit(command, ...args);
  } catch {
    // Analytics must never break the app.
  }
}

type TermlyApi = {
  on?: (event: string, callback: () => void) => void;
  getConsentState?: () => Record<string, boolean | undefined> | null | undefined;
};

// Mirror the Termly cookie banner's analytics choice to Letter: when the visitor
// accepts or withdraws, and on every later page load where they already chose.
function syncTermlyConsent(termly: TermlyApi) {
  const apply = () => {
    const state = termly.getConsentState?.();
    if (state) letter("consent", state.analytics ? "granted" : "denied");
  };
  termly.on?.("initialized", apply);
  termly.on?.("consent", apply);
  apply();
}

export function startLetterConsent() {
  let attempts = 0;
  const waitForTermly = () => {
    const termly = (window as Window & { Termly?: TermlyApi }).Termly;
    if (termly?.on) syncTermlyConsent(termly);
    else if (attempts++ < 40) window.setTimeout(waitForTermly, 250);
  };
  waitForTermly();
}
