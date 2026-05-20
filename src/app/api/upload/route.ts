import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { getServerAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session || !hasPermission(session.user.role, "manage_projects")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const uploadDir = process.env.UPLOAD_DIR;
  console.log("[UPLOAD-DBG] UPLOAD_DIR:", uploadDir);
  if (!uploadDir) {
    return NextResponse.json({ error: "Upload directory not configured" }, { status: 500 });
  }

  try {
    const ext = extname(file.name) || ".jpg";
    const filename = `${randomUUID()}${ext}`;
    const destDir = join(uploadDir, "manual");
    console.log("[UPLOAD-DBG] destDir:", destDir, "| file:", filename, "| size:", file.size);
    await mkdir(destDir, { recursive: true });
    console.log("[UPLOAD-DBG] mkdir OK");
    const destPath = join(destDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(destPath, buffer);
    console.log("[UPLOAD-DBG] writeFile OK →", destPath);

    // Return canonical path matching spectre bot convention (/app/data → nginx root)
    const path = `/app/data/manual/${filename}`;
    return NextResponse.json({ path });
  } catch (err) {
    console.error("[UPLOAD-DBG] FAILED:", err);
    return NextResponse.json({ error: "Failed to write file" }, { status: 500 });
  }
}
