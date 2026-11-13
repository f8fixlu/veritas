import { NextResponse } from "next/server";
import { requireApiAdmin, verifyUserPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HEI_TYPES, PH_REGIONS } from "@/lib/school-options";
import { listSchoolOptions } from "@/lib/school-options-server";

export async function GET() {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schools = await listSchoolOptions();
  return NextResponse.json(
    { schools },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const region = String(body?.region ?? "");
  const heiType = String(body?.heiType ?? "");
  const heiCode = String(body?.heiCode ?? "").trim();
  const id = body?.id === undefined ? null : Number(body.id);
  if (!name || name.length > 120 || !heiCode || heiCode.length > 40 || !PH_REGIONS.includes(region as (typeof PH_REGIONS)[number]) || !HEI_TYPES.includes(heiType as (typeof HEI_TYPES)[number])) {
    return NextResponse.json(
      { error: "Enter a name and HEI code, choose a valid region and HEI type, and keep the code within 40 characters." },
      { status: 400 },
    );
  }

  const db = getDb();
  const options = await db.schoolOption.findMany();
  const duplicate = options.find(
    (school) => school.name.toLocaleLowerCase() === name.toLocaleLowerCase() && school.id !== id,
  );
  if (id === null && duplicate?.deletedAt) {
    const school = await db.schoolOption.update({
      where: { id: duplicate.id },
      data: { name, region, heiType, heiCode: heiCode || null, deletedAt: null },
    });
    return NextResponse.json({ ok: true, school });
  }
  if (duplicate) {
    return NextResponse.json({ error: "That school / HEI is already on the list. Edit its entry instead." }, { status: 409 });
  }

  const data = { name, region, heiType, heiCode: heiCode || null };
  if (id !== null) {
    if (!Number.isSafeInteger(id) || id < 1) {
      return NextResponse.json({ error: "Invalid school / HEI." }, { status: 400 });
    }
    const existing = await db.schoolOption.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "School / HEI not found." }, { status: 404 });
    }
    const school = await db.schoolOption.update({ where: { id }, data });
    return NextResponse.json({ ok: true, school });
  }

  const school = await db.schoolOption.create({ data });
  return NextResponse.json({ ok: true, school });
}

export async function DELETE(req: Request) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  const password = String(body?.password ?? "");
  if (!Number.isSafeInteger(id) || id < 1 || !password) {
    return NextResponse.json(
      { error: "Choose a school and enter your password to remove it." },
      { status: 400 },
    );
  }
  if (!(await verifyUserPassword(admin.id, password))) {
    return NextResponse.json({ error: "Your password was incorrect." }, { status: 401 });
  }

  const db = getDb();
  const school = await db.schoolOption.findUnique({ where: { id } });
  if (!school || school.deletedAt) {
    return NextResponse.json({ error: "School or HEI not found." }, { status: 404 });
  }
  await db.schoolOption.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
