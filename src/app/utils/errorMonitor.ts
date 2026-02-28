// ============================================================
// Lightweight Error Monitor
// Zero dependencies, works offline, optional remote reporting
// ============================================================
// Usage:
//   import { errorMonitor } from '../utils/errorMonitor';
//   errorMonitor.install();          // Call once at app startup
//   errorMonitor.capture(error);     // Manual capture
//   errorMonitor.getLog();           // Get all stored errors
//   errorMonitor.flush();            // Send to remote endpoint
//   errorMonitor.clear();            // Clear stored errors
// ============================================================

const LS_KEY = '__taproot_error_log__';
const LS_DEVICE_ID = '__taproot_device_id__';
const MAX_ERRORS = 50;          // Max stored errors (FIFO)
const MAX_AGE_MS = 7 * 24 * 3600 * 1000; // Auto-clean after 7 days
const FLUSH_DEBOUNCE_MS = 5000; // Batch errors for 5s before sending

export interface ErrorEntry {
  id: string;
  timestamp: string;
  type: 'js' | 'unhandledrejection' | 'react' | 'network' | 'manual';
  message: string;
  stack?: string;
  componentStack?: string;  // React error boundary stack
  url: string;
  userAgent: string;
  deviceId: string;
  meta?: Record<string, unknown>;
}

// Generate a stable device ID (persisted in localStorage)
function getDeviceId(): string {
  try {
    let id = localStorage.getItem(LS_DEVICE_ID);
    if (id) return id;
    // Simple fingerprint: random + timestamp
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(LS_DEVICE_ID, id);
    return id;
  } catch {
    return 'dev_unknown';
  }
}

// Get the device ID (exported for gradual rollout use)
export function getStableDeviceId(): string {
  return getDeviceId();
}

class ErrorMonitor {
  private installed = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private reportEndpoint: string | null = null;
  private deviceId: string = '';

  /**
   * Install global error handlers.
   * Call once at app startup (e.g., in main.tsx or Root.tsx).
   */
  install(options?: { reportEndpoint?: string }) {
    if (this.installed) return;
    this.installed = true;
    this.deviceId = getDeviceId();
    this.reportEndpoint = options?.reportEndpoint || null;

    // Clean old errors on startup
    this.cleanOld();

    // Global JS errors
    window.addEventListener('error', (event) => {
      // Ignore errors from browser extensions
      if (event.filename && !event.filename.includes(location.origin)) return;

      this.addEntry({
        type: 'js',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
        url: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : location.href,
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.addEntry({
        type: 'unhandledrejection',
        message: reason?.message || String(reason) || 'Unhandled promise rejection',
        stack: reason?.stack,
        url: location.href,
      });
    });

    // Network errors (fetch failures)
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        // Track 5xx server errors
        if (response.status >= 500) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
          this.addEntry({
            type: 'network',
            message: `HTTP ${response.status} ${response.statusText}`,
            url,
            meta: { status: response.status },
          });
        }
        return response;
      } catch (err: any) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
        this.addEntry({
          type: 'network',
          message: err?.message || 'Network request failed',
          url,
        });
        throw err;
      }
    };

    console.log('[ErrorMonitor] Installed, device:', this.deviceId);
  }

  /**
   * Manually capture an error (e.g., from React ErrorBoundary)
   */
  capture(error: Error | unknown, meta?: { type?: ErrorEntry['type']; componentStack?: string; context?: string }) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.addEntry({
      type: meta?.type || 'manual',
      message: err.message,
      stack: err.stack,
      componentStack: meta?.componentStack,
      url: location.href,
      meta: meta?.context ? { context: meta.context } : undefined,
    });
  }

  /**
   * Get all stored error entries
   */
  getLog(): ErrorEntry[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get error count
   */
  getCount(): number {
    return this.getLog().length;
  }

  /**
   * Get a summary of errors for display
   */
  getSummary(): { total: number; byType: Record<string, number>; last24h: number; lastError?: ErrorEntry } {
    const log = this.getLog();
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const byType: Record<string, number> = {};
    let last24h = 0;

    for (const entry of log) {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
      if (now - new Date(entry.timestamp).getTime() < day) last24h++;
    }

    return {
      total: log.length,
      byType,
      last24h,
      lastError: log[log.length - 1],
    };
  }

  /**
   * Clear all stored errors
   */
  clear() {
    try {
      localStorage.removeItem(LS_KEY);
      console.log('[ErrorMonitor] Log cleared');
    } catch { /* ignore */ }
  }

  /**
   * Set the remote reporting endpoint
   */
  setReportEndpoint(url: string | null) {
    this.reportEndpoint = url;
  }

  /**
   * Flush (send) errors to the remote endpoint
   * Returns true if successfully sent, false otherwise
   */
  async flush(): Promise<boolean> {
    if (!this.reportEndpoint) {
      console.log('[ErrorMonitor] No report endpoint configured, skipping flush');
      return false;
    }

    const log = this.getLog();
    if (log.length === 0) return true;

    try {
      const response = await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.deviceId,
          appVersion: this.getAppVersion(),
          errors: log,
          flushedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        this.clear();
        console.log(`[ErrorMonitor] Flushed ${log.length} errors to server`);
        return true;
      }
      console.warn(`[ErrorMonitor] Flush failed: HTTP ${response.status}`);
      return false;
    } catch (err: any) {
      console.warn('[ErrorMonitor] Flush failed:', err.message);
      return false;
    }
  }

  // ---- Internal ----

  private addEntry(partial: Omit<ErrorEntry, 'id' | 'timestamp' | 'userAgent' | 'deviceId'> & { url: string }) {
    const entry: ErrorEntry = {
      id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      deviceId: this.deviceId,
      ...partial,
    };

    // Truncate long stacks to save space
    if (entry.stack && entry.stack.length > 2000) {
      entry.stack = entry.stack.slice(0, 2000) + '\n... (truncated)';
    }
    if (entry.componentStack && entry.componentStack.length > 1000) {
      entry.componentStack = entry.componentStack.slice(0, 1000) + '\n... (truncated)';
    }

    try {
      const log = this.getLog();
      log.push(entry);
      // FIFO: remove oldest if over limit
      while (log.length > MAX_ERRORS) log.shift();
      localStorage.setItem(LS_KEY, JSON.stringify(log));
    } catch {
      // localStorage full — try clearing old entries and retry
      try {
        localStorage.setItem(LS_KEY, JSON.stringify([entry]));
      } catch { /* truly out of space, give up */ }
    }

    // Console log for dev visibility
    console.error(`[ErrorMonitor] Captured ${entry.type}:`, entry.message);

    // Schedule a debounced flush
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (!this.reportEndpoint) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, FLUSH_DEBOUNCE_MS);
  }

  private cleanOld() {
    try {
      const log = this.getLog();
      const cutoff = Date.now() - MAX_AGE_MS;
      const filtered = log.filter((e) => new Date(e.timestamp).getTime() > cutoff);
      if (filtered.length < log.length) {
        localStorage.setItem(LS_KEY, JSON.stringify(filtered));
        console.log(`[ErrorMonitor] Cleaned ${log.length - filtered.length} old entries`);
      }
    } catch { /* ignore */ }
  }

  private getAppVersion(): string {
    try {
      // Try to get version from SW
      return localStorage.getItem('taproot_remote_config')
        ? JSON.parse(localStorage.getItem('taproot_remote_config')!).version || 'unknown'
        : 'unknown';
    } catch {
      return 'unknown';
    }
  }
}

// Singleton instance
export const errorMonitor = new ErrorMonitor();
