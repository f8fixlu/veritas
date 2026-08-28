import { NextResponse } from "next/server";
import { getSessionState } from "@/lib/auth";

export async function GET() {
  const state = await getSessionState();
  const res = NextResponse.json(
    state.authenticated
      ? { authenticated: true, role: state.user.role }
      : { authenticated: false, evicted: state.evicted }
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}