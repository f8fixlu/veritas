import crypto from "crypto";

// Uppercase letters and digits, minus look-alikes (0/O and 1/I) so codes can
// be dictated/typed without mistakes.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LENGTH = 6;

/**
 * Returns a cryptographically random 6-character enrollment token. Uniqueness
 * is enforced by `Subject.joinToken @unique`; callers retry on P2002.
 */
export function generateJoinToken(): string {
  const bytes = crypto.randomBytes(LENGTH);
  let token = "";
  for (let i = 0; i < LENGTH; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return token;
}