/**
 * SmartAttendanceTracker: Auto-calculates engagement score from WebRTC/participant metadata.
 * Consumes presence, audio/video activity, and duration to produce a 0-100 engagement score.
 * Used when a participant leaves or when the session ends; can trigger StudentCoach nudges for low engagement.
 */

export interface ParticipantEvent {
  /** "joined" | "left" | "audio_on" | "audio_off" | "video_on" | "video_off" | "focus" | "background" */
  type: string;
  timestamp: string; // ISO
  /** Seconds since session start, if available */
  elapsedSeconds?: number;
}

export interface SmartAttendanceInput {
  /** Session start time (ISO) */
  sessionStartAt: string;
  /** Events for this participant (ordered by time) */
  events: ParticipantEvent[];
  /** Total session duration in seconds (optional; used to weight time present) */
  sessionDurationSeconds?: number;
}

export interface SmartAttendanceResult {
  /** 0-100 engagement score */
  engagementScore: number;
  /** Seconds the participant was "present" (joined and not left) */
  presenceSeconds: number;
  /** Approximate seconds with audio and/or video active (participating) */
  activeSeconds: number;
  /** Human-readable summary for UI */
  summary: string;
}

/**
 * Compute engagement from event stream.
 * - presenceSeconds: from first joined to last left (or now if still in call).
 * - activeSeconds: time with audio_on or video_on (we don't double-count overlapping).
 * - engagementScore: weighted combination of presence ratio and activity ratio, capped 0-100.
 */
export function computeEngagementFromMetadata(
  input: SmartAttendanceInput
): SmartAttendanceResult {
  const start = new Date(input.sessionStartAt).getTime();
  const events = [...input.events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let joinedAt: number | null = null;
  let leftAt: number | null = null;
  let lastActiveStart: number | null = null;
  let activeSeconds = 0;

  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    switch (e.type) {
      case "joined":
        joinedAt = t;
        leftAt = null;
        break;
      case "left":
        if (lastActiveStart != null) {
          activeSeconds += (t - lastActiveStart) / 1000;
          lastActiveStart = null;
        }
        leftAt = t;
        break;
      case "audio_on":
      case "video_on":
        if (lastActiveStart == null) lastActiveStart = t;
        break;
      case "audio_off":
      case "video_off":
        if (lastActiveStart != null) {
          activeSeconds += (t - lastActiveStart) / 1000;
          lastActiveStart = null;
        }
        break;
      case "background":
        if (lastActiveStart != null) {
          activeSeconds += (t - lastActiveStart) / 1000;
          lastActiveStart = null;
        }
        break;
      default:
        break;
    }
  }
  if (lastActiveStart != null && leftAt != null) {
    activeSeconds += (leftAt - lastActiveStart) / 1000;
  } else if (lastActiveStart != null && joinedAt != null) {
    const end = input.sessionDurationSeconds
      ? start + input.sessionDurationSeconds * 1000
      : Date.now();
    activeSeconds += (Math.min(end, Date.now()) - lastActiveStart) / 1000;
  }

  const presenceSeconds =
    joinedAt != null && leftAt != null
      ? (leftAt - joinedAt) / 1000
      : joinedAt != null
        ? (Math.min(
            input.sessionDurationSeconds
              ? start + input.sessionDurationSeconds * 1000
              : Date.now(),
            Date.now()
          ) -
            joinedAt) /
          1000
        : 0;

  const duration =
    input.sessionDurationSeconds ?? Math.max(1, presenceSeconds);
  const presenceRatio = Math.min(1, presenceSeconds / duration);
  const activityRatio =
    presenceSeconds > 0 ? Math.min(1, activeSeconds / presenceSeconds) : 0;
  // Weight: 50% presence, 50% activity during presence
  const engagementScore = Math.round(
    Math.min(100, (presenceRatio * 50 + activityRatio * 50))
  );

  let summary = "";
  if (presenceSeconds < 60) {
    summary = "Minimal presence";
  } else if (engagementScore >= 80) {
    summary = "High engagement";
  } else if (engagementScore >= 50) {
    summary = "Moderate engagement";
  } else {
    summary = "Low engagement — consider follow-up";
  }

  return {
    engagementScore,
    presenceSeconds: Math.round(presenceSeconds),
    activeSeconds: Math.round(activeSeconds),
    summary,
  };
}
