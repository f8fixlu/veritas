import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireApiAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

type ParsedQuestion = {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  sectionId: number | null;
  sectionName: string | null;
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickField(row: Record<string, unknown>, candidates: string[]): string {
  for (const candidate of candidates) {
    const value = row[candidate];
    if (value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function resolveAnswer(
  answer: string,
  options: { a: string; b: string; c: string; d: string }
): "A" | "B" | "C" | "D" | null {
  let normalized = answer.trim().toUpperCase();
  if (/^[ABCD]$/.test(normalized)) return normalized as "A" | "B" | "C" | "D";
  // Tolerate trailing punctuation like "A.", "B)", "C:"
  normalized = normalized.replace(/[.)}\]:,]+$/, "");
  if (/^[ABCD]$/.test(normalized)) return normalized as "A" | "B" | "C" | "D";
  const withParen = normalized.replace(/^\(([A-D])\)$/, "$1");
  if (/^[ABCD]$/.test(withParen)) return withParen as "A" | "B" | "C" | "D";
  if (normalized === "1") return "A";
  if (normalized === "2") return "B";
  if (normalized === "3") return "C";
  if (normalized === "4") return "D";
  const target = answer.trim().toLowerCase();
  const entries: Array<["A" | "B" | "C" | "D", string]> = [
    ["A", options.a],
    ["B", options.b],
    ["C", options.c],
    ["D", options.d],
  ];
  for (const [letter, value] of entries) {
    if (value.trim().toLowerCase() === target) return letter;
  }
  return null;
}

export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireApiAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const examId = Number((await ctx.params).id);
  if (!Number.isInteger(examId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = getDb();
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      _count: { select: { attempts: true } },
      sections: { orderBy: { order: "asc" }, select: { id: true, name: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (exam._count.attempts > 0) {
    return NextResponse.json(
      { error: "Students have already taken this exam, so questions can no longer be imported or changed." },
      { status: 409 }
    );
  }

  const form = await req.formData().catch(() => null);
  let file: File;
  try {
    const value = form?.get("file");
    if (!(value instanceof File)) throw new Error("no file");
    file = value;
  } catch {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

  // Optional target section for every imported question that has no
  // "section" column of its own.
  let targetSectionId: number | null = null;
  const rawSectionId = form?.get("sectionId");
  if (rawSectionId !== null && String(rawSectionId).trim() !== "") {
    const parsed = Number(rawSectionId);
    if (!Number.isInteger(parsed) || !exam.sections.some((s) => s.id === parsed)) {
      return NextResponse.json(
        { error: "The selected section does not belong to this exam." },
        { status: 400 }
      );
    }
    targetSectionId = parsed;
  }

  // When false, new questions are appended after the existing ones instead
  // of replacing them.
  const replace = String(form?.get("replace") ?? "true") === "true";

  const sectionsByName = new Map(
    exam.sections.map((s) => [s.name.trim().toLowerCase(), s.id])
  );

  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a .csv, .xlsx or .xls file." },
      { status: 400 }
    );
  }

  let rows: Record<string, unknown>[];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (name.endsWith(".csv")) {
      const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
      const workbook = XLSX.read(text, { type: "string", raw: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, {
        defval: "",
        raw: false,
      });
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!, {
        defval: "",
        raw: false,
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Could not read the file. Make sure it is a valid CSV or Excel file." },
      { status: 400 }
    );
  }

  const parsed: ParsedQuestion[] = [];
  let skipped = 0;
  const skipDetails: string[] = [];
  const newSectionNames = new Map<string, string>();

  rows.forEach((rawRow, rowIndex) => {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawRow)) {
      row[normalizeKey(key)] = value;
    }

    const text = pickField(row, ["question", "q", "questiontext", "text"]);
    const a = pickField(row, ["optiona", "a", "choicea", "opta"]);
    const b = pickField(row, ["optionb", "b", "choiceb", "optb"]);
    const c = pickField(row, ["optionc", "c", "choicec", "optc"]);
    const d = pickField(row, ["optiond", "d", "choiced", "optd"]);
    const answerRaw = pickField(row, ["answer", "correct", "correctanswer", "key", "ans"]);

    // Ignore fully blank rows (trailing newlines etc.)
    if (!text && !a && !b && !c && !d && !answerRaw) return;

    const missing: string[] = [];
    if (!text) missing.push("question");
    if (!a) missing.push("option_a");
    if (!b) missing.push("option_b");
    if (!c) missing.push("option_c");
    if (!d) missing.push("option_d");
    if (!answerRaw) missing.push("answer");
    if (missing.length > 0) {
      skipped++;
      skipDetails.push(
        `Row ${rowIndex + 2}: missing ${missing.join(", ")}`
      );
      return;
    }
    const correctOption = resolveAnswer(answerRaw, { a, b, c, d });
    if (!correctOption) {
      skipped++;
      skipDetails.push(
        `Row ${rowIndex + 2}: answer "${answerRaw}" is not A, B, C or D`
      );
      return;
    }

    // Per-row section name wins; otherwise fall back to the panel selection.
    // Unknown names are created later (see below) instead of skipping the row.
    let sectionId: number | null = targetSectionId;
    const sectionName = pickField(row, ["section", "sectionname", "part"]);
    if (sectionName) {
      const key = sectionName.toLowerCase();
      sectionId = sectionsByName.get(key) ?? null;
      if (!sectionsByName.has(key)) {
        newSectionNames.set(key, sectionName);
      }
    }

    parsed.push({
      text,
      optionA: a,
      optionB: b,
      optionC: c,
      optionD: d,
      correctOption,
      sectionId,
      sectionName: sectionName || null,
    });
  });

  if (parsed.length === 0) {
    return NextResponse.json(
      {
        error: `No valid questions were found in the file (${skipped} skipped).`,
        skipDetails,
      },
      { status: 400 }
    );
  }

  // Create sections referenced by the file that don't exist yet, using the
  // exam's default points per question.
  const createdSections: string[] = [];
  if (newSectionNames.size > 0) {
    let order = exam.sections.length;
    for (const [key, name] of newSectionNames) {
      const created = await db.examSection.create({
        data: {
          examId,
          name,
          pointsPerQuestion: exam.pointsPerQuestion,
          order: order++,
        },
      });
      sectionsByName.set(key, created.id);
      createdSections.push(name);
    }
  }

  let startOrder = 1;
  if (!replace) {
    const maxOrder = await db.question.aggregate({
      where: { examId },
      _max: { order: true },
    });
    startOrder = (maxOrder._max.order ?? 0) + 1;
  }

  await db.$transaction([
    ...(replace
      ? [db.question.deleteMany({ where: { examId } })]
      : []),
    ...parsed.map((q, index) =>
      db.question.create({
        data: {
          examId,
          sectionId:
            q.sectionName
              ? (sectionsByName.get(q.sectionName.toLowerCase()) ?? null)
              : q.sectionId,
          order: startOrder + index,
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
        },
      })
    ),
  ]);

  return NextResponse.json({
    ok: true,
    imported: parsed.length,
    skipped,
    skipDetails,
    sectionsCreated: createdSections,
    replaced: replace,
  });
}
