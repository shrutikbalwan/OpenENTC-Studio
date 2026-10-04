// Size budget for what the browser downloads (and the service worker precaches) on first visit.
// The build fails when the web assets grow past it, so growth is a deliberate, reviewed change.
// Raise a budget in the same pull request that explains why the extra bytes are needed.
export const BUNDLE_BUDGET = Object.freeze({
  totalBytes: 3_500_000, // measured 2.73 MB on 2026-10-04
  largestFileBytes: 256_000, // measured 164 KB (packages/mcu/src/avr/examples.mjs)
});

/**
 * @param {{ path: string, bytes: number }[]} assets web assets only
 * @param {{ totalBytes: number, largestFileBytes: number }} [budget]
 */
export function checkBundleBudget(assets, budget = BUNDLE_BUDGET) {
  const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const largest = assets.reduce((max, asset) => (asset.bytes > max.bytes ? asset : max), { path: '', bytes: 0 });
  const problems = [];
  if (total > budget.totalBytes) problems.push(`web assets total ${total} bytes, over the ${budget.totalBytes}-byte budget`);
  if (largest.bytes > budget.largestFileBytes) problems.push(`${largest.path} is ${largest.bytes} bytes, over the ${budget.largestFileBytes}-byte single-file budget`);
  return { total, largest, problems };
}
