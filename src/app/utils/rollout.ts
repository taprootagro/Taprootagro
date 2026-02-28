// ============================================================
// Gradual Rollout System
// ============================================================
// Determines if the current device is in the rollout group
// based on a stable device ID and the rollout percentage
// from the remote config.
//
// How it works:
// 1. Each device gets a stable random ID (persisted in localStorage)
// 2. The ID is hashed to a number between 0-99
// 3. If that number < rolloutPercentage, the device is in the group
//
// Remote config format:
// {
//   "version": "v7",
//   "rolloutPercentage": 30,    // 0-100, default 100 (everyone)
//   "rolloutMinVersion": "v5",  // Optional: only rollout from this version+
//   "forceUpdate": false         // Optional: skip rollout, push to everyone
// }
// ============================================================

import { getStableDeviceId } from './errorMonitor';

const LS_KEY_REMOTE_CONFIG = 'taproot_remote_config';

/**
 * Hash a string to a number between 0-99.
 * Simple but deterministic — same input always gives same output.
 */
function hashToPercent(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Get the device's rollout bucket (0-99).
 * This is deterministic — same device always gets the same bucket.
 */
export function getDeviceRolloutBucket(): number {
  const deviceId = getStableDeviceId();
  return hashToPercent(deviceId);
}

/**
 * Check if the current device is in the rollout group.
 * 
 * @param rolloutPercentage - 0 to 100, percentage of devices to include
 * @returns true if this device should receive the update
 */
export function isInRolloutGroup(rolloutPercentage: number): boolean {
  // Edge cases
  if (rolloutPercentage >= 100) return true;
  if (rolloutPercentage <= 0) return false;

  const bucket = getDeviceRolloutBucket();
  return bucket < rolloutPercentage;
}

export interface RolloutConfig {
  version?: string;
  rolloutPercentage?: number;  // 0-100, default 100
  rolloutMinVersion?: string;  // Only apply rollout to devices on this version+
  forceUpdate?: boolean;       // Skip rollout check, push to all
}

/**
 * Get the stored remote config.
 */
export function getStoredRemoteConfig(): RolloutConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY_REMOTE_CONFIG);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Determine if an update should be shown to this device.
 * Takes into account rollout percentage, force update flag, etc.
 * 
 * @param config - Remote config (or null to use stored config)
 * @param currentVersion - The currently installed SW version (e.g., "v6")
 * @returns { shouldUpdate, reason }
 */
export function shouldShowUpdate(
  config: RolloutConfig | null,
  currentVersion: string
): { shouldUpdate: boolean; reason: string } {
  if (!config) {
    config = getStoredRemoteConfig();
  }

  if (!config || !config.version) {
    return { shouldUpdate: true, reason: 'No remote config, default to show update' };
  }

  // Version match — no update needed
  if (config.version === currentVersion) {
    return { shouldUpdate: false, reason: 'Already on latest version' };
  }

  // Force update — bypass rollout
  if (config.forceUpdate) {
    return { shouldUpdate: true, reason: 'Force update enabled' };
  }

  // Rollout percentage check
  const rolloutPct = config.rolloutPercentage ?? 100;
  const inGroup = isInRolloutGroup(rolloutPct);
  const bucket = getDeviceRolloutBucket();

  if (inGroup) {
    return {
      shouldUpdate: true,
      reason: `In rollout group (bucket ${bucket}, rollout ${rolloutPct}%)`,
    };
  }

  return {
    shouldUpdate: false,
    reason: `Not in rollout group (bucket ${bucket}, rollout ${rolloutPct}%)`,
  };
}
