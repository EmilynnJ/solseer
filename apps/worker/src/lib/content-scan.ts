// Rule-based screening for community posts and comments. Matches never block
// publishing; they file a moderation flag so an Admin can review it.
export const AUTOMATED_FLAG_PREFIX = "Automated scan:";

const RULES: { reason: string; pattern: RegExp }[] = [
  {
    reason: "contact details (email address)",
    pattern: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/i,
  },
  {
    reason: "contact details (phone number)",
    pattern: /(?:\+?\d[\s().-]?){10,}/,
  },
  {
    reason: "off-platform payment",
    pattern:
      /\b(?:cash\s?app|venmo|paypal|zelle|apple\s?pay|western\s?union|bitcoin|crypto(?:currency)?)\b|(?:^|\s)\$[a-z][\w-]{2,}/i,
  },
  {
    reason: "off-platform contact",
    pattern:
      /\b(?:whats\s?app|telegram|signal\s+me|snapchat|kik|text\s+me|call\s+me|dm\s+me\s+on)\b/i,
  },
  {
    reason: "external link",
    pattern: /\bhttps?:\/\/|\bwww\.[\w-]+\./i,
  },
  {
    reason: "guaranteed outcome claim",
    pattern: /\b(?:guarantee[ds]?|100\s?%\s*(?:accurate|guaranteed|results?))\b/i,
  },
  {
    reason: "possible self-harm (check on this person)",
    pattern:
      /\b(?:kill\s+myself|suicid(?:e|al)|end\s+my\s+life|want\s+to\s+die|self[\s-]?harm)\b/i,
  },
];

export function scanContent(text: string): string[] {
  return RULES.filter((rule) => rule.pattern.test(text)).map(
    (rule) => rule.reason,
  );
}

export function automatedFlagReason(matches: string[]): string | null {
  return matches.length
    ? `${AUTOMATED_FLAG_PREFIX} ${matches.join("; ")}`
    : null;
}

// User reports may not claim to be automated detections.
export function isReservedFlagReason(reason: string): boolean {
  return reason.trim().toLowerCase().startsWith(AUTOMATED_FLAG_PREFIX.toLowerCase());
}
