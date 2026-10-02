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
  return generateToken();
}

/**
 * Same alphabet/size as the enrollment tokens, used for an instructor's
 * personal student code (`User.studentCode @unique`). Uniqueness is enforced
 * by the unique constraint; callers retry on P2002.
 */
export function generateStudentCode(): string {
  return generateToken();
}

function generateToken(): string {
  const bytes = crypto.randomBytes(LENGTH);
  let token = "";
  for (let i = 0; i < LENGTH; i++) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return token;
}