import { NextResponse } from "next/server";
import { listSchoolOptions } from "@/lib/school-options-server";

export async function GET() {
  const schools = await listSchoolOptions();
  return NextResponse.json(
    { schools: schools.map(({ id, name }) => ({ id, name })) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
