export const ORDER_STAGES = [
  { key: "placed", label: "Order Placed" },
  { key: "accepted", label: "Accepted by Artisan" },
  { key: "preparing", label: "Preparing Product" },
  { key: "shipped", label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered Successfully" },
] as const;

export type OrderStageKey = typeof ORDER_STAGES[number]["key"];

export function stageIndex(status: string): number {
  const i = ORDER_STAGES.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

export function nextStage(status: string): OrderStageKey | null {
  const i = stageIndex(status);
  if (i >= ORDER_STAGES.length - 1) return null;
  return ORDER_STAGES[i + 1].key;
}
