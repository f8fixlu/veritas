import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Subject name is required." }, { status: 400 });
  }

  try {
    const subject = await getDb().subject.create({
      data: { name, description: description || null },
    });
    return NextResponse.json({ ok: true, id: subject.id });
  } catch {
    return NextResponse.json(
      { error: "A subject with this name already exists." },
      { status: 409 }
    );
  }
}
