export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Kept only for compatibility with older imports. Google credentials are now
// verified by the server and must never be trusted from decoded client claims.
export function decodeJWT() { return null; }
