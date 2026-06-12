export interface ManagedType {
  id: number;
  name: string;
}

/**
 * Maps an AI-returned type name to a DB id.
 * Returns null when name is null/empty or no match found.
 */
export function resolveTypeId(
  typeName: string | null | undefined,
  availableTypes: ManagedType[],
): number | null {
  if (!typeName) return null;
  const match = availableTypes.find(
    (t) => t.name === typeName.trim(),
  );
  return match?.id ?? null;
}
