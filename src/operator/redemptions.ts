// Redemption helpers shared by the operator tabs.
export function isOpen(r: any): boolean {
  return r && !["completed", "settled"].includes(r.state);
}

/** Seconds left at `hs`, or null. */
export function etaSeconds(
  r: any,
  hs: number | null | undefined
): number | null {
  if (!hs || !(r.remaining_tih > 0)) return null;
  return (r.remaining_tih * 2 ** 40) / hs;
}

export function stateLabel(r: any): string {
  if (r.paused_by) return "Paused";
  switch (r.state) {
    case "pending":
      return (r.rigs || []).length ? "Starting" : "Waiting for a rig";
    case "active":
      return (r.rigs || []).length ? "Mining" : "Waiting for a rig";
    case "completed":
      return "Delivered";
    case "settled":
      return "Stopped";
    default:
      return r.state;
  }
}
