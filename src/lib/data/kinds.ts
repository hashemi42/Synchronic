/** Lane kinds, apart from schema.ts so that the browser does not load zod for them. */
export const LANE_KINDS = ["state", "rival", "parallel", "occupation", "no-state", "ruled-by"] as const;

/** Whether a kind runs beside the lane's main sequence instead of being part of it. */
export const isBeside = (kind: (typeof LANE_KINDS)[number]) => kind === "rival" || kind === "parallel";
