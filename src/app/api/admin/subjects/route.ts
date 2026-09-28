import { NextResponse } from "next/server";
import { requireApiStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { canManageContent } from "@/lib/scope";
import { generateJoinToken } from "@/lib/tokens";

export async function POST(req: Request) {
  const user = await requireApiStaff();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageContent(user)) {
    return NextResponse.json(
      { error: "Only instructors can create subjects." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const description = String(body?.description ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Subject name is required." }, { status: 400 });
  }

  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const subject = await db.subject.create({
        data: {
          name,
          description: description || null,
          ownerId: user.id,
          joinToken: generateJoinToken(),
        },
      });
      return NextResponse.json({ ok: true, id: subject.id, joinToken: subject.joinToken });
    } catch (err) {
      const code = (err as { code?: string }).code;
      // A token collision is retried; a duplicate owner/name pair is a 409.
      if (code === "P2002") {
        const taken = await db.subject.findUnique({
          where: { ownerId_name: { ownerId: user.id, name } },
          select: { id: true },
        });
        if (taken) {
          return NextResponse.json(
            { error: "You already have a subject with this name." },
            { status: 409 }
          );
        }
        continue;
      }
      throw err;
    }
  }

  return NextResponse.json(
    { error: "Could not generate a unique enrollment token. Try again." },
    { status: 500 }
  );
}
