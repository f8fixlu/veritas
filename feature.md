# AI Assist — exam import from doc / pdf / excel

## Goal

Let an instructor upload a `.docx`, `.pdf` or `.xlsx` file, have an LLM extract
multiple-choice questions in the Veritas template, review them in an inline
preview, and commit them to an exam.

**Flow:** upload → extract text → send to the AI endpoint (with exam + subject
context) → AI returns questions in the Veritas template → instructor
reviews/edits a preview → confirm → questions written to the exam.

## Decisions made

- **Provider:** OpenAI-compatible `/chat/completions` against the user's
  OmniRouter endpoint (plain `fetch`, no SDK).
- **Review:** preview table, then confirm (editable).
- **Placement:** new "AI assist" card in the exam page's right column, above
  `ImportPanel`.
- **Upload size:** 10 MB for the AI path (spreadsheets stay at 2 MB).
- **Context:** pass exam title + subject name to the AI.

## New files

- `src/lib/ai.ts`
  - Thin OpenAI-compatible client: `POST {VERITAS_AI_BASE_URL}/chat/completions`.
  - Reads `VERITAS_AI_BASE_URL`, `VERITAS_AI_API_KEY`, `VERITAS_AI_MODEL`.
  - Typed `AiNotConfiguredError` so the UI can show "set up the endpoint".
  - One retry with a repair prompt if the model returns invalid JSON.

- `src/lib/document.ts`
  - Text extraction with `AI_MAX_UPLOAD_BYTES` (10 MB) and a max extracted-text
    length to bound cost.
  - `.docx` → `mammoth`
  - `.pdf` → `unpdf` (modern ESM pdfjs; avoids the `pdf-parse` test-file /
    `require.main` bug)
  - `.xlsx/.xls` → reuse existing `readSpreadsheetRecords`

- `src/app/api/admin/exams/[id]/ai-import/route.ts`
  - `POST` — **parse only**, no DB writes.
  - Auth: `requireApiStaff` + `canManageContent` + `ownedExamWhere` + locked
    check (reuse the same rules as `/import`).
  - Extract text → call AI → return `{ questions, warnings, model }`.
  - Rate-limited per user (e.g. 10 parses/hour — it costs money).

- `src/app/api/admin/exams/[id]/ai-import/confirm/route.ts`
  - `POST` with the confirmed questions array.
  - **Re-validates every field server-side** (never trusts the model).
  - Creates sections the AI named (same behavior as the CSV import).
  - Inserts questions in a transaction.

- `src/components/admin/ai-assist-panel.tsx`
  - Client card: file picker, "Analyze", inline editable preview (edit
    question/options/answer/section, remove row, show skipped/warnings),
    "Import N questions" → `router.refresh()`.

- `src/lib/env.ts`
  - AI env accessors + a startup/dev hint.

## Changed files

- `src/app/admin/exams/[id]/page.tsx` — add `<AiAssistPanel>` in the right
  column above `ImportPanel`.
- `package.json` — add `mammoth`, `unpdf`.
- `README.md` / `prod.md` — document the three env vars and the 10 MB limit.

## Guardrails

- AI output is untrusted: validate text / options / answer `A–D` / section, cap
  question count and field lengths, return 422 on invalid.
- Reuse the existing CSRF guard and ownership scoping; 404 for another owner's
  exam.
- Sections the AI invents are created automatically (same behavior as the CSV
  import).

## Open decisions

- **PDF lib:** recommend `unpdf` over `pdf-parse`.
- **Rate limit:** 10 parses/user/hour.
- **Preview editing:** full inline editing of all fields.
