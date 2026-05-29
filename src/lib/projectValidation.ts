const CODE_RE = /^[a-z0-9]{2,32}$/;

export interface ProjectRow {
  id: number;
  code: string;
  aliases: string[];
}

/** Returns an error message or null if valid. */
export function validateCode(code: string): string | null {
  if (!CODE_RE.test(code)) {
    return "code ต้องเป็น a-z, 0-9 ความยาว 2–32 ตัว";
  }
  return null;
}

/** Returns an error message or null if all aliases are valid. */
export function validateAliases(aliases: string[]): string | null {
  for (const alias of aliases) {
    if (!CODE_RE.test(alias)) {
      return `alias "${alias}" ต้องเป็น a-z, 0-9 ความยาว 2–32 ตัว`;
    }
  }
  return null;
}

/**
 * Checks cross-project collision: the given code/aliases must not appear
 * as code OR alias in any other project. Pass excludeId for edit case.
 */
export function checkCollision(
  code: string,
  aliases: string[],
  existing: ProjectRow[],
  excludeId?: number,
): string | null {
  const others = excludeId != null ? existing.filter(p => p.id !== excludeId) : existing;
  const tokens = [code, ...aliases];
  for (const other of others) {
    const otherTokens = [other.code, ...other.aliases];
    for (const token of tokens) {
      if (otherTokens.includes(token)) {
        return `"${token}" ชนกับ project "${other.code}"`;
      }
    }
  }
  return null;
}
