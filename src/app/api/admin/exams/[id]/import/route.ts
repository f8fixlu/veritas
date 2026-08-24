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
  const normalized = answer.trim().toUpperCase();
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
    include: { _count: { select: { attempts: true } } },
  });
  if (!exam) return NextResponse.json({ error: "Exam not found." }, { status: 404 });
  if (exam._count.attempts > 0) {
    return NextResponse.json(
      { error: "Students have already taken this exam, so questions can no longer be imported or changed." },
      { status: 409 }
    );
  }

  let file: File;
  try {
    const form = await req.formData();
    const value = form.get("file");
    if (!(value instanceof File)) throw new Error("no file");
    file = value;
  } catch {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }

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

  for (const rawRow of rows) {
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

    if (!text || !a || !b || !c || !d || !answerRaw) {
      skipped++;
      continue;
    }
    const correctOption = resolveAnswer(answerRaw, { a, b, c, d });
    if (!correctOption) {
      skipped++;
      continue;
    }
    parsed.push({ text, optionA: a, optionB: b, optionC: c, optionD: d, correctOption });
  }

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: `No valid questions were found in the file (${skipped} invalid rows).` },
      { status: 400 }
    );
  }

  await db.$transaction([
    db.question.deleteMany({ where: { examId } }),
    ...parsed.map((q, index) =>
      db.question.create({
        data: {
          examId,
          order: index + 1,
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

  return NextResponse.json({ ok: true, imported: parsed.length, skipped });
}
