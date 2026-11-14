/**
 * Moves `id` to `to` (an index in the list after removal), never above the
 * first `pinned` items: the anchor lane stays first (IN-9).
 */
export function moveTo<T>(list: readonly T[], id: T, to: number, pinned = 0): T[] {
  const from = list.indexOf(id);
  if (from === -1 || from < pinned) return [...list];
  const rest = list.filter((x) => x !== id);
  const index = Math.min(Math.max(to, pinned), rest.length);
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

/** Moves `id` one place up (-1) or down (1). */
export const moveBy = <T,>(list: readonly T[], id: T, step: -1 | 1, pinned = 0): T[] =>
  moveTo(list, id, list.indexOf(id) + step, pinned);
