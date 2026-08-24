export type ImmutableAuditEvent<T extends object> = Readonly<T>;

/**
 * Creates a frozen event record before persistence. The database layer only has
 * an append operation for mission events; no application procedure exposes an
 * edit or delete path for this record type.
 */
export function createImmutableAuditEvent<T extends object>(event: T): ImmutableAuditEvent<T> {
  return Object.freeze({ ...event });
}

export function nextAuditSequence(existingSequences: readonly number[]): number {
  return existingSequences.length === 0 ? 1 : Math.max(...existingSequences) + 1;
}
