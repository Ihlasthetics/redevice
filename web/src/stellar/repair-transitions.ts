import type { Status } from "./client";

const transitions: Record<Status, readonly Status[]> = {
  Used: ["Repaired", "Refurbished", "PartsOnly"],
  Repaired: ["Refurbished", "PartsOnly"],
  Refurbished: ["Repaired", "PartsOnly"],
  PartsOnly: [],
};

export function allowedRepairStatuses(current: Status): readonly Status[] {
  return transitions[current];
}
