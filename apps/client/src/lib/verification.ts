export function verificationLinkError(code: string | null): string | null {
  if (code === "TOKEN_EXPIRED") {
    return "This verification link has expired. Enter your email below to request a new link, then open the newest email promptly.";
  }
  if (code === "INVALID_TOKEN") {
    return "This verification link is invalid. Enter your email below to request a new link, then open the newest email.";
  }
  return null;
}
