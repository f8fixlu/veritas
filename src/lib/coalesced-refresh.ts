/**
 * Coalesces a burst of `router.refresh()` calls into one.
 *
 * The live rows on a report page all observe the same status poll, so a whole
 * class starting (or finishing) at once makes every row request a refresh on
 * the same tick — 30+ full page re-renders fired simultaneously, right when the
 * server is already busiest. Routing them through here collapses the burst to a
 * single refresh (the row's own badge has already updated from the poll data).
 *
 * Leading-edge: the first caller refreshes immediately and the window swallows
 * the rest, so a refresh never lands after the user has navigated away.
 */
let suppressed = false;

export function scheduleRefresh(refresh: () => void, windowMs = 600): void {
  if (suppressed) return;
  suppressed = true;
  setTimeout(() => {
    suppressed = false;
  }, windowMs);
  refresh();
}
