// Timing utilities

interface PhaseTimings {
  start: number;
  end: number | null;
  duration: number | null;
}

interface TimingsState {
  testStart: number;
  phases: Record<string, PhaseTimings>;
  current: string | null;
}

const timings: TimingsState = {
  testStart: 0,
  phases: {},
  current: null,
};

export function startTiming(phase: string): void {
  const now = Date.now();
  if (timings.testStart === 0) {
    timings.testStart = now;
  }

  timings.current = phase;
  timings.phases[phase] = { start: now, end: null, duration: null };
  console.log(
    `⏱️  [${formatElapsed(now - timings.testStart)}] Starting: ${phase}`
  );
}

export function endTiming(phase?: string | null): void {
  const now = Date.now();
  const targetPhase = phase ?? timings.current;

  if (!targetPhase || !timings.phases[targetPhase]) {
    console.warn(`Warning: No timing started for phase: ${targetPhase}`);
    return;
  }

  timings.phases[targetPhase].end = now;
  timings.phases[targetPhase].duration =
    now - timings.phases[targetPhase].start;

  console.log(
    `✅ [${formatElapsed(now - timings.testStart)}] Completed: ${targetPhase} (${formatDuration(timings.phases[targetPhase].duration!)})`
  );

  if (timings.current === targetPhase) {
    timings.current = null;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatElapsed(ms: number): string {
  return formatDuration(ms);
}

export function logProgress(message: string): void {
  const elapsed = Date.now() - timings.testStart;
  console.log(`⏱️  [${formatElapsed(elapsed)}] ${message}`);
}

export function printTimingSummary(): void {
  console.log("\n📊 TIMING SUMMARY");
  console.log("================");

  const totalTime = Date.now() - timings.testStart;
  console.log(`Total test time: ${formatDuration(totalTime)}\n`);

  const sortedPhases = Object.entries(timings.phases).sort(
    ([, a], [, b]) => (a as PhaseTimings).start - (b as PhaseTimings).start
  );

  for (const [phase, timing] of sortedPhases) {
    const phaseTimings = timing as PhaseTimings;
    if (phaseTimings.duration !== null) {
      const percentage = ((phaseTimings.duration / totalTime) * 100).toFixed(1);
      console.log(
        `  ${phase.padEnd(30)} ${formatDuration(phaseTimings.duration).padEnd(8)} (${percentage}%)`
      );
    } else {
      console.log(`  ${phase.padEnd(30)} ${"INCOMPLETE".padEnd(8)}`);
    }
  }
  console.log("");
}
