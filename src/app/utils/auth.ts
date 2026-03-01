// ============================================================================
// Auth Utilities — Login State + User ID Management
// ============================================================================
// User ID assignment follows a two-tier strategy:
//
//   Tier 1 (Production — Backend Enabled):
//     Login → Supabase Auth verifies credentials → returns server-assigned
//     user.id (UUID) → stored locally → used as IM identity.
//     The server-assigned ID is cryptographically random, globally unique,
//     and cannot be forged by the client. The Edge Function's /auth endpoint
//     is the single source of truth.
//
//   Tier 2 (Template Demo — No Backend):
//     Login → client generates a 10-digit numeric ID locally.
//     This is ONLY for white-label template preview / offline demo.
//     It provides no security guarantees.
//
// ID storage keys:
//   - SERVER_USER_ID_KEY: server-assigned ID (takes priority)
//   - NUMERIC_ID_KEY:     locally generated fallback
//
// The IM registration flow uses whichever ID is available (server > local).
// ============================================================================

const LOGIN_KEY = "isLoggedIn";
const NUMERIC_ID_KEY = "agri_user_numeric_id";
const SERVER_USER_ID_KEY = "agri_server_user_id";
const AUTH_SOURCE_KEY = "agri_auth_source"; // "server" | "local"

/**
 * Check if user is logged in
 */
export function isUserLoggedIn(): boolean {
  return localStorage.getItem(LOGIN_KEY) === "true";
}

/**
 * Set user login status.
 * When logging in (status=true) WITHOUT a server ID, generates a local fallback.
 * When logging out (status=false), preserves IDs for potential re-login.
 *
 * For server-assigned IDs, call setServerUserId() BEFORE setUserLoggedIn(true).
 */
export function setUserLoggedIn(status: boolean): void {
  if (status) {
    localStorage.setItem(LOGIN_KEY, "true");
    // If no server ID was set before this call, generate a local fallback
    if (!getServerUserId() && !getLocalNumericId()) {
      const newId = generateNumericId();
      localStorage.setItem(NUMERIC_ID_KEY, newId);
      localStorage.setItem(AUTH_SOURCE_KEY, "local");
      console.log(`[Auth] Local fallback ID generated: ${newId} (no backend)`);
    }
  } else {
    localStorage.removeItem(LOGIN_KEY);
    // Preserve IDs so re-login retains the same IM identity
  }
}

// ---- Server-Assigned ID (Tier 1 — Production) ----

/**
 * Store a server-assigned user ID (from Supabase Auth via Edge Function).
 * This MUST be called before setUserLoggedIn(true) when backend is available.
 *
 * @param id - The user.id UUID returned by Supabase Auth
 */
export function setServerUserId(id: string): void {
  localStorage.setItem(SERVER_USER_ID_KEY, id);
  localStorage.setItem(AUTH_SOURCE_KEY, "server");
  console.log(`[Auth] Server-assigned user ID stored: ${id}`);
}

/**
 * Get the server-assigned user ID (null if not set / using local fallback)
 */
export function getServerUserId(): string | null {
  return localStorage.getItem(SERVER_USER_ID_KEY);
}

/**
 * Check whether the current ID was assigned by the server (secure) or
 * generated locally (insecure demo mode).
 */
export function isServerAssignedId(): boolean {
  return localStorage.getItem(AUTH_SOURCE_KEY) === "server";
}

// ---- Effective User ID (used by IM services) ----

/**
 * Get the user's effective ID for IM communication.
 * Priority: server-assigned UUID > locally generated numeric ID > null
 */
export function getUserId(): string | null {
  return getServerUserId() || getLocalNumericId();
}

/**
 * @deprecated Use getUserId() instead. Kept for backward compatibility.
 * Returns the locally generated numeric ID (null if never generated).
 */
export function getNumericUserId(): string | null {
  // Return effective ID (server > local) for backward compatibility
  return getUserId();
}

/**
 * Get ONLY the locally generated numeric ID (ignoring server ID).
 * Used internally and for migration scenarios.
 */
export function getLocalNumericId(): string | null {
  return localStorage.getItem(NUMERIC_ID_KEY);
}

/**
 * Generate a 10-digit unique numeric ID (local fallback only).
 * Format: 6 timestamp-derived digits + 4 random digits
 */
function generateNumericId(): string {
  const timePart = (Date.now() % 1_000_000_000).toString().padStart(9, "0").slice(0, 6);
  const randPart = Math.floor(1000 + Math.random() * 9000).toString();
  return timePart + randPart;
}

/**
 * Clear all auth data (login status + all IDs).
 * Use this for "delete account" scenarios.
 */
export function clearAuthData(): void {
  localStorage.removeItem(LOGIN_KEY);
  localStorage.removeItem(NUMERIC_ID_KEY);
  localStorage.removeItem(SERVER_USER_ID_KEY);
  localStorage.removeItem(AUTH_SOURCE_KEY);
}

/**
 * Check if login is required; if not logged in, navigate to login page.
 */
export function requireLogin(
  navigate: (path: string) => void,
  callback?: () => void
): boolean {
  const loggedIn = isUserLoggedIn();

  if (!loggedIn) {
    navigate("/login");
    return false;
  }

  if (callback) {
    callback();
  }

  return true;
}