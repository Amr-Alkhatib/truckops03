import { createServerFn } from "@tanstack/react-start";

/**
 * Contact address for data protection requests, shown on /privacy.
 * Set it as the PRIVACY_CONTACT_EMAIL secret (Lovable Cloud → Secrets); it is
 * read on the server so the address lives in configuration, not in the code.
 */
export const getPrivacyContact = createServerFn({ method: "GET" }).handler(async () => ({
  email: process.env.PRIVACY_CONTACT_EMAIL?.trim() || null,
}));
