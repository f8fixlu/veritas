import { getDb } from "@/lib/db";

export async function listSchoolOptions() {
  const db = getDb();
  const existingSchools = await db.user.findMany({
    where: { school: { not: null } },
    select: { school: true },
    distinct: ["school"],
  });
  const options = await db.schoolOption.findMany({ select: { name: true } });
  const knownNames = new Set(options.map(({ name }) => name.toLocaleLowerCase()));
  for (const { school } of existingSchools) {
    const name = school?.trim();
    if (!name || knownNames.has(name.toLocaleLowerCase())) continue;
    await db.schoolOption.upsert({ where: { name }, update: {}, create: { name } });
    knownNames.add(name.toLocaleLowerCase());
  }

  return db.schoolOption.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, region: true, heiType: true, heiCode: true },
  });
}

export async function resolveSchoolOption(name: string) {
  const normalized = name.trim().toLocaleLowerCase();
  if (!normalized) return null;
  const options = await listSchoolOptions();
  return options.find((option) => option.name.toLocaleLowerCase() === normalized) ?? null;
}
