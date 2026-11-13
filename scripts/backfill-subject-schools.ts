import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url:
      process.env.VERITAS_DB_FILE ??
      path.join(process.cwd(), "prisma", "dev.db"),
  }),
});

async function main() {
  const subjects = await db.subject.findMany({
    where: { schoolOptionId: null, owner: { is: { school: { not: null } } } },
    select: { id: true, owner: { select: { school: true } } },
  });
  if (subjects.length === 0) {
    console.log("Every subject with an owner school is already linked to a School / HEI.");
    return;
  }

  const options = await db.schoolOption.findMany();
  const byName = new Map(options.map((option) => [option.name.toLocaleLowerCase(), option]));
  let linked = 0;
  let skipped = 0;

  for (const subject of subjects) {
    const name = subject.owner?.school?.trim();
    if (!name) {
      skipped++;
      continue;
    }
    let option = byName.get(name.toLocaleLowerCase());
    if (!option) {
      option = await db.schoolOption.create({ data: { name } });
      byName.set(name.toLocaleLowerCase(), option);
    } else if (option.deletedAt) {
      option = await db.schoolOption.update({
        where: { id: option.id },
        data: { deletedAt: null },
      });
      byName.set(name.toLocaleLowerCase(), option);
    }
    await db.subject.update({
      where: { id: subject.id },
      data: { schoolOptionId: option.id },
    });
    linked++;
  }

  console.log(`Linked ${linked} subject(s) to their owner's School / HEI; skipped ${skipped} without an owner school.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
