export interface EditAuditOptions {
  by: string;
  note?: string;
}

export interface DeleteAuditOptions {
  by: string;
  reason: string;
}

export interface EditAuditFields {
  last_edited_by: string;
  last_edited_at: Date;
  last_edited_note?: string;
}

export interface DeleteAuditFields {
  deleted_by: string;
  deleted_at: Date;
  delete_reason: string;
}

export function withEditAudit<T extends object>(
  payload: T,
  opts: EditAuditOptions
): T & EditAuditFields {
  const audit: EditAuditFields = {
    last_edited_by: opts.by,
    last_edited_at: new Date(),
  };
  if (opts.note !== undefined) {
    audit.last_edited_note = opts.note;
  }
  return { ...payload, ...audit };
}

export function withDeleteAudit(opts: DeleteAuditOptions): DeleteAuditFields {
  return {
    deleted_by: opts.by,
    deleted_at: new Date(),
    delete_reason: opts.reason,
  };
}
