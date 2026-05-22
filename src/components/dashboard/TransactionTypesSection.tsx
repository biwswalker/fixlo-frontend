"use client";

import React, { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tag, Plus, Trash2, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  createTransactionType,
  deleteTransactionType,
  type TransactionType,
} from "@/actions/dashboard";

interface TransactionTypesSectionProps {
  types: TransactionType[];
  projectId: string;
  currentProjectDbId: number | null;
}

export function TransactionTypesSection({
  types,
  projectId,
  currentProjectDbId,
}: TransactionTypesSectionProps) {
  const [localTypes, setLocalTypes] = useState(types);
  const [newName, setNewName] = useState("");
  const [isPending, start] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<TransactionType | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    start(async () => {
      const res = await createTransactionType(projectId, newName.trim());
      if (res.success && res.id != null) {
        setLocalTypes((prev) => [
          ...prev,
          {
            id: res.id!,
            project_id: currentProjectDbId,
            name: newName.trim(),
            created_by: null,
            created_at: new Date().toISOString(),
          },
        ]);
        setNewName("");
        toast.success("เพิ่ม transaction type สำเร็จ");
      } else {
        toast.error(res.error ?? "เกิดข้อผิดพลาด");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    start(async () => {
      const res = await deleteTransactionType(id);
      if (res.success) {
        setLocalTypes((prev) => prev.filter((t) => t.id !== id));
        setDeleteTarget(null);
        toast.success("ลบ transaction type สำเร็จ");
      } else {
        toast.error(res.error ?? "เกิดข้อผิดพลาด");
        setDeleteTarget(null);
      }
    });
  };

  const isProjectScoped = (t: TransactionType) =>
    t.project_id !== null && t.project_id === currentProjectDbId;

  return (
    <Card className="border-none shadow-sm rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">Transaction Types</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        หมวดหมู่สำหรับจำแนก slip — ประเภทที่ไม่มี project คือ global (ใช้ได้ทุกโปรเจกต์)
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="ชื่อประเภทใหม่ เช่น รายจ่าย"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="h-9 rounded-xl text-sm"
          disabled={isPending || projectId === "all"}
        />
        <Button
          size="sm"
          className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          onClick={handleCreate}
          disabled={isPending || !newName.trim() || projectId === "all"}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          เพิ่ม
        </Button>
      </div>
      {projectId === "all" && (
        <p className="text-xs text-amber-600">เลือก project เฉพาะก่อนจึงจะเพิ่ม type ได้</p>
      )}

      <div className="space-y-2">
        {localTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มี transaction type</p>
        ) : (
          localTypes.map((t) => {
            const isGlobal = t.project_id === null;
            const isDeletable = isProjectScoped(t);
            return (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{t.name}</span>
                  {isGlobal && (
                    <Badge variant="outline" className="text-[10px] rounded-full px-1.5 py-0 gap-1">
                      <Globe className="h-2.5 w-2.5" />
                      Global
                    </Badge>
                  )}
                </div>
                {isDeletable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-rose-600"
                    disabled={isPending}
                    onClick={() => setDeleteTarget(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ลบ transaction type?</DialogTitle>
            <DialogDescription>
              ลบ &ldquo;{deleteTarget?.name}&rdquo; — ถ้ามี slip ใช้ type นี้อยู่จะไม่สามารถลบได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              ยกเลิก
            </Button>
            <Button
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "ลบ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
