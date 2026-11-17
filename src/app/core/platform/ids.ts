/** Random, collision-safe ids that a server can accept as primary keys later. */
export function newId(): string {
  return crypto.randomUUID();
}
