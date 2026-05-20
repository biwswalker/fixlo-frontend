"use client";

import React, { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ProjectAccount } from "@/types/dashboard";
import {
  createProjectAccount,
  updateProjectAccount,
  softDeleteProjectAccount,
} from "@/actions/dashboard";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Loader2, X, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AccountFormState {
  accountName: string;
  bankCode: string;
  accountNumber: string;
  aliases: string[];
  aliasInput: string;
}

const emptyForm = (): AccountFormState => ({
  accountName: "",
  bankCode: "",
  accountNumber: "",
  aliases: [],
  aliasInput: "",
});

function AccountForm({
  form,
  onChange,
}: {
  form: AccountFormState;
  onChange: (next: AccountFormState) => void;
}) {
  const addAlias = () => {
    const tag = form.aliasInput.trim();
    if (!tag || form.aliases.includes(tag)) return;
    onChange({ ...form, aliases: [...form.aliases, tag], aliasInput: "" });
  };

  const removeAlias = (tag: string) => {
    onChange({ ...form, aliases: form.aliases.filter((a) => a !== tag) });
  };

  return (
    <div className="space-y-3 py-2">
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">ชื่อบัญชี *</label>
        <Input
          value={form.accountName}
          onChange={(e) => onChange({ ...form, accountName: e.target.value })}
          placeholder="สมชาย ใจดี"
          className="rounded-xl border-gray-200 h-9 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">รหัสธนาคาร *</label>
        <Input
          value={form.bankCode}
          onChange={(e) => onChange({ ...form, bankCode: e.target.value })}
          placeholder="scb / kbank / bbl ..."
          className="rounded-xl border-gray-200 h-9 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">หมายเลขบัญชี</label>
        <Input
          value={form.accountNumber}
          onChange={(e) => onChange({ ...form, accountNumber: e.target.value })}
          placeholder="xxx-x-xxxxx-x (optional)"
          className="rounded-xl border-gray-200 h-9 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">Aliases</label>
        <div className="flex gap-2">
          <Input
            value={form.aliasInput}
            onChange={(e) => onChange({ ...form, aliasInput: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
            placeholder="พิมพ์แล้วกด Enter เพื่อเพิ่ม"
            className="rounded-xl border-gray-200 h-9 text-sm flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={addAlias} className="rounded-xl h-9 shrink-0">
            เพิ่ม
          </Button>
        </div>
        {form.aliases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {form.aliases.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs flex items-center gap-1">
                {tag}
                <button onClick={() => removeAlias(tag)} className="ml-0.5 hover:text-red-500 transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AccountsTableProps {
  accounts: ProjectAccount[];
  projectId: string;
}

export function AccountsTable({ accounts, projectId }: AccountsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AccountFormState>(emptyForm());

  const [editTarget, setEditTarget] = useState<ProjectAccount | null>(null);
  const [editForm, setEditForm] = useState<AccountFormState>(emptyForm());

  const [deleteTarget, setDeleteTarget] = useState<ProjectAccount | null>(null);

  const parseAliases = (raw: string | undefined): string[] => {
    if (!raw) return [];
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  };

  const openEdit = (acc: ProjectAccount) => {
    setEditTarget(acc);
    setEditForm({
      accountName: acc.account_name,
      bankCode: acc.bank_code,
      accountNumber: acc.account_number ?? "",
      aliases: parseAliases(acc.aliases),
      aliasInput: "",
    });
  };

  const handleCreate = () => {
    if (!createForm.accountName.trim() || !createForm.bankCode.trim()) {
      toast.error("กรุณากรอกชื่อบัญชีและรหัสธนาคาร");
      return;
    }
    startTransition(async () => {
      const result = await createProjectAccount(
        projectId,
        createForm.accountName.trim(),
        createForm.bankCode.trim(),
        createForm.accountNumber.trim(),
        createForm.aliases,
      );
      if (result.success) {
        toast.success("เพิ่มบัญชีสำเร็จ");
        setCreateOpen(false);
        setCreateForm(emptyForm());
        router.refresh();
      } else {
        toast.error(result.error ?? "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleUpdate = () => {
    if (!editTarget || !editForm.accountName.trim() || !editForm.bankCode.trim()) {
      toast.error("กรุณากรอกชื่อบัญชีและรหัสธนาคาร");
      return;
    }
    startTransition(async () => {
      const result = await updateProjectAccount(
        editTarget.id,
        editForm.accountName.trim(),
        editForm.bankCode.trim(),
        editForm.accountNumber.trim(),
        editForm.aliases,
      );
      if (result.success) {
        toast.success("แก้ไขบัญชีสำเร็จ");
        setEditTarget(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleDelete = (acc: ProjectAccount) => {
    startTransition(async () => {
      const result = await softDeleteProjectAccount(acc.id);
      if (result.success) {
        toast.success("ลบบัญชีสำเร็จ");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <>
      {projectId !== "all" && (
        <div className="flex justify-end mb-4">
          <Button
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-bold text-sm"
            onClick={() => { setCreateForm(emptyForm()); setCreateOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            เพิ่มบัญชี
          </Button>
        </div>
      )}

      <Card className="border-none shadow-xl shadow-gray-200/50 rounded-2xl overflow-hidden bg-white">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="border-gray-100">
                <TableHead className="px-6 py-4 text-gray-500 font-medium">ชื่อบัญชี</TableHead>
                <TableHead className="text-gray-500 font-medium">ธนาคาร</TableHead>
                <TableHead className="text-gray-500 font-medium">หมายเลขบัญชี</TableHead>
                <TableHead className="text-gray-500 font-medium">Aliases</TableHead>
                <TableHead className="text-right px-6 text-gray-500 font-medium">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-400 font-medium">
                    ยังไม่มีบัญชีในระบบ — กดปุ่ม "เพิ่มบัญชี" เพื่อเริ่ม
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((acc) => {
                  const aliases = parseAliases(acc.aliases);
                  return (
                    <TableRow key={acc.id} className="border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <TableCell className="px-6 py-4 font-bold text-gray-900">{acc.account_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full text-xs font-mono uppercase">
                          {acc.bank_code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">
                        {acc.account_number || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {aliases.length === 0
                            ? <span className="text-xs text-gray-300">-</span>
                            : aliases.map((a) => (
                                <Badge key={a} variant="secondary" className="rounded-full text-[10px] px-2 py-0.5">{a}</Badge>
                              ))
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={() => openEdit(acc)}
                            disabled={isPending}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteTarget(acc)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              เพิ่มบัญชีใหม่
            </DialogTitle>
            <DialogDescription>กรอกข้อมูลบัญชีธนาคาร</DialogDescription>
          </DialogHeader>
          <AccountForm form={createForm} onChange={setCreateForm} />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)} disabled={isPending}>ยกเลิก</Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(o) => { if (!o) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              แก้ไขบัญชี
            </DialogTitle>
            <DialogDescription>แก้ไขข้อมูลบัญชี {editTarget?.account_name}</DialogDescription>
          </DialogHeader>
          <AccountForm form={editForm} onChange={setEditForm} />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditTarget(null)} disabled={isPending}>ยกเลิก</Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white" onClick={handleUpdate} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              ยืนยันการลบบัญชี
            </DialogTitle>
            <DialogDescription>
              ลบ <span className="font-semibold text-gray-900">{deleteTarget?.account_name}</span> ออกจากระบบ?
              <br />
              บัญชีที่มีรายการผูกอยู่จะไม่สามารถลบได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteTarget(null)} disabled={isPending}>ยกเลิก</Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
