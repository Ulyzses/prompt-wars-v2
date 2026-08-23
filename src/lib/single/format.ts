/** Solve times are ranked and shown at 0.1s granularity (specifications.md). */
export function formatSolveTime(ms: number): string {
  return `${(Math.floor(ms / 100) / 10).toFixed(1)}s`;
}
