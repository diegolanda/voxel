import {
  classifyError,
  createErrorEnvelope,
  type ErrorCategory,
  type ErrorEnvelope,
} from "@voxel/domain";

const queue: ErrorEnvelope[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlush() {
  if (flushTimer) return;
  flushTimer = setInterval(flushErrors, 30_000);
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flushErrors);
  }
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const category = classifyError(error);
  const message = error instanceof Error ? error.message : String(error);
  const envelope = createErrorEnvelope(category, "error", message, {
    context,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });
  console.error(`[${category}]`, message, context ?? "");
  queue.push(envelope);
  ensureFlush();
}

export function reportWarning(
  category: ErrorCategory,
  message: string,
  context?: Record<string, unknown>,
): void {
  const envelope = createErrorEnvelope(category, "warning", message, {
    context,
    url: typeof window !== "undefined" ? window.location.href : undefined,
  });
  console.warn(`[${category}]`, message, context ?? "");
  queue.push(envelope);
  ensureFlush();
}

export function flushErrors(): void {
  if (queue.length === 0) return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn && typeof navigator !== "undefined" && navigator.sendBeacon) {
    const payload = JSON.stringify(queue.splice(0));
    navigator.sendBeacon(dsn, payload);
  } else {
    // No DSN configured — drain the queue to avoid unbounded growth
    queue.length = 0;
  }
}
