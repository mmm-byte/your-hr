/**
 * Correlation identifiers (AUD-002, AUD-004).
 *
 * A correlation ID is the only diagnostic handle exposed to the user. It lets
 * support match a user's screenshot to a server-side log entry without the log
 * containing salary data, connection strings, or stack traces.
 *
 * The value is random rather than sequential so it cannot be used to count or
 * predict requests.
 */

const HEX_ALPHABET = '0123456789abcdef';

function randomHex(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += HEX_ALPHABET[byte % 16];
  }
  return out;
}

/**
 * Create a new correlation ID.
 *
 * Format: `ch_<32 hex chars>` — short enough to read aloud in a support
 * conversation, long enough that collisions are not a practical concern.
 */
export function createCorrelationId(): string {
  return `ch_${randomHex(32)}`;
}
