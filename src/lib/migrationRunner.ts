export interface MigrationMeta {
  seq: number;
  filename: string;
}

export function isMigrationFile(filename: string): boolean {
  return /^\d{3}_(?!.*_rollback).*\.sql$/.test(filename);
}

export function parseMigrationFiles(filenames: string[]): MigrationMeta[] {
  return filenames
    .filter(isMigrationFile)
    .map((filename) => ({
      seq: parseInt(filename.slice(0, 3), 10),
      filename,
    }));
}

export function sortMigrations(migrations: MigrationMeta[]): MigrationMeta[] {
  return [...migrations].sort((a, b) => a.seq - b.seq);
}
