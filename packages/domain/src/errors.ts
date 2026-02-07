// ── Error tracking envelope & classification ─────────────────────────

export enum ErrorCategory {
  Auth = "auth",
  Network = "network",
  WebRTC = "webrtc",
  Engine = "engine",
  Storage = "storage",
  Validation = "validation",
  Voice = "voice",
  Unknown = "unknown",
}

export type ErrorSeverity = "fatal" | "error" | "warning" | "info";

export interface ErrorEnvelope {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  url?: string;
  userId?: string;
  roomId?: string;
}

export function createErrorEnvelope(
  category: ErrorCategory,
  severity: ErrorSeverity,
  message: string,
  extra?: Partial<Pick<ErrorEnvelope, "code" | "context" | "url" | "userId" | "roomId">>,
): ErrorEnvelope {
  return {
    category,
    severity,
    message,
    timestamp: Date.now(),
    ...extra,
  };
}

export function classifyError(error: unknown): ErrorCategory {
  const message =
    error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : "";

  // Auth errors
  if (name === "AuthError" || /auth|unauthorized|unauthenticated|session.?expired/i.test(message)) {
    return ErrorCategory.Auth;
  }

  // Network errors
  if (
    name === "TypeError" && /failed to fetch|network/i.test(message) ||
    /ECONNREFUSED|ETIMEDOUT|network|fetch/i.test(message)
  ) {
    return ErrorCategory.Network;
  }

  // WebRTC errors
  if (/RTCPeerConnection|RTCDataChannel|ICE|DTLS|webrtc/i.test(message + name)) {
    return ErrorCategory.WebRTC;
  }

  // Engine / rendering errors
  if (/WebGL|three\.?js|renderer|shader|GPU|context lost/i.test(message + name)) {
    return ErrorCategory.Engine;
  }

  // Storage errors
  if (/storage|upload|bucket|save|snapshot|quota/i.test(message)) {
    return ErrorCategory.Storage;
  }

  // Validation errors (Zod, schema)
  if (name === "ZodError" || /validation|invalid|schema|parse/i.test(message)) {
    return ErrorCategory.Validation;
  }

  // Voice / microphone errors
  if (
    name === "NotAllowedError" ||
    /microphone|getUserMedia|NotAllowedError|audio|MediaStream/i.test(message + name)
  ) {
    return ErrorCategory.Voice;
  }

  return ErrorCategory.Unknown;
}
