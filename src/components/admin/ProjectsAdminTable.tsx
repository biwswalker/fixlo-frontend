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
import { createProject, updateProject, setProjectStatus } from "@/actions/projectAdmin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface Project {
  id: number;
  code: string;
  project_name: string;
  status: string;
  discord_channel_id: string | null;
  active_date: string | null;
  aliases: string[];
}

interface Props {
  projects: Project[];
}

function AliasInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInput("");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="เพิ่ม alias แล้วกด Enter"
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          เพิ่ม
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {value.map((alias) => (
          <Badge key={alias} variant="secondary" className="cursor-pointer" onClick={() => onChange(value.filter((a) => a !== alias))}>
            {alias} ×
          </Badge>
        ))}
      </div>
    </div>
  );
}

interface FormState {
  code: string;
  project_name: string;
  discord_channel_id: string;
  active_date: string;
  aliases: string[];
}

const EMPTY_FORM: FormState = {
  code: "",
  project_name: "",
  discord_channel_id: "",
  active_date: "",
  aliases: [],
};

export function ProjectsAdminTable({ projects }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(p: Project) {
    setForm({
      code: p.code,
      project_name: p.project_name,
      discord_channel_id: p.discord_channel_id ?? "",
      active_date: p.active_date ?? "",
      aliases: p.aliases,
    });
    setEditProject(p);
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createProject({
        code: form.code,
        project_name: form.project_name,
        discord_channel_id: form.discord_channel_id || undefined,
        active_date: form.active_date || undefined,
        aliases: form.aliases,
      });
      if (res.success) {
        toast.success("สร้างโปรเจกต์แล้ว");
        setCreateOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleEdit() {
    if (!editProject) return;
    startTransition(async () => {
      const res = await updateProject(editProject.id, {
        project_name: form.project_name,
        discord_channel_id: form.discord_channel_id || undefined,
        active_date: form.active_date || undefined,
        aliases: form.aliases,
      });
      if (res.success) {
        toast.success("แก้ไขแล้ว");
        setEditProject(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleToggleStatus(p: Project) {
    const next = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    startTransition(async () => {
      const res = await setProjectStatus(p.id, next);
      if (res.success) {
        toast.success(`${next === "ACTIVE" ? "เปิด" : "ปิด"}โปรเจกต์แล้ว`);
        if (next === "ACTIVE") {
          toast.info("ต้อง restart bot off-hours เพื่อโหลด project ใหม่");
        }
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const formFields = (isCreate: boolean) => (
    <div className="space-y-4">
      {isCreate && (
        <div>
          <label className="text-sm font-medium text-gray-700">Code (ตัวพิมพ์เล็ก a-z, 0-9 เท่านั้น)</label>
          <Input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="เช่น juno168"
          />
        </div>
      )}
      {!isCreate && (
        <div>
          <label className="text-sm font-medium text-gray-700">Code</label>
          <Badge variant="outline" className="text-sm font-mono">{form.code}</Badge>
        </div>
      )}
      <div>
        <label className="text-sm font-medium text-gray-700">ชื่อโปรเจกต์</label>
        <Input
          value={form.project_name}
          onChange={(e) => setForm((f) => ({ ...f, project_name: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Discord Channel ID</label>
        <Input
          value={form.discord_channel_id}
          onChange={(e) => setForm((f) => ({ ...f, discord_channel_id: e.target.value }))}
          placeholder="เช่น 1234567890"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Active Date (YYYY-MM-DD)</label>
        <Input
          value={form.active_date}
          type="date"
          onChange={(e) => setForm((f) => ({ ...f, active_date: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Aliases</label>
        <AliasInput value={form.aliases} onChange={(v) => setForm((f) => ({ ...f, aliases: v }))} />
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <span className="text-sm text-gray-500">{projects.length} โปรเจกต์</span>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่มโปรเจกต์
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>Discord Channel</TableHead>
                <TableHead>Active Date</TableHead>
                <TableHead>Aliases</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-mono font-bold">{p.code}</TableCell>
                  <TableCell>{p.project_name}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.discord_channel_id ?? "—"}</TableCell>
                  <TableCell className="text-xs">{p.active_date ?? "—"}</TableCell>
                  <TableCell>
                    {p.aliases.length > 0
                      ? p.aliases.map((a) => (
                          <Badge key={a} variant="outline" className="mr-1 text-xs">{a}</Badge>
                        ))
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        แก้ไข
                      </Button>
                      <Button
                        size="sm"
                        variant={p.status === "ACTIVE" ? "destructive" : "default"}
                        onClick={() => handleToggleStatus(p)}
                        disabled={isPending}
                      >
                        {p.status === "ACTIVE" ? "ปิด" : "เปิด"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มโปรเจกต์ใหม่</DialogTitle>
            <DialogDescription>โปรเจกต์ใหม่จะมีสถานะ INACTIVE ก่อน</DialogDescription>
          </DialogHeader>
          {formFields(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleCreate} disabled={isPending}>สร้าง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editProject} onOpenChange={(open) => !open && setEditProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขโปรเจกต์</DialogTitle>
            <DialogDescription>Code ไม่สามารถเปลี่ยนได้หลังสร้าง</DialogDescription>
          </DialogHeader>
          {formFields(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>ยกเลิก</Button>
            <Button onClick={handleEdit} disabled={isPending}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
