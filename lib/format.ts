/** Tiny presentation-time formatters. PURE — no React, deterministic given an
 * explicit `now`, so they run under bun in scripts/tests. */

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Compact "time since" label, e.g. "just now", "5m ago", "3h ago", "2d ago",
 * "4w ago". Coarsens as the gap grows — good enough for a "last practiced"
 * caption where exactness past a few weeks doesn't matter. */
export function timeAgo(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return `${Math.floor(diff / WEEK)}w ago`;
}
