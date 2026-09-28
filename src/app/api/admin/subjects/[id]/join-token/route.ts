import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent, ownedSubjectWhere } from "@/lib/scope";
import { generateJoinToken } from "@/lib/tokens";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only the instructor who owns a subject can change its token." },
      { status: 403 }
    );
  }

  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const subject = await db.subject.findFirst({
    where: { id, ...ownedSubjectWhere(user) },
    select: { id: true },
  });
  if (!subject) {
    return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const token = generateJoinToken();
      await db.subject.update({ where: { id }, data: { joinToken: token } });
      return NextResponse.json({ ok: true, token });
    } catch (err) {
      if ((err as { code?: string }).code !== "P2002") throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique enrollment token. Try again." },
    { status: 500 }
  );
}