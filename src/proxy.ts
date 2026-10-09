import { NextResponse, type NextRequest } from "next/server";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF guard: state-changing API requests must come from the same origin as the
 * one they target. Browsers always attach an Origin header to non-GET requests,
 * so a request with a missing or mismatched Origin is treated as cross-site and
 * rejected before it reaches a route handler. Comparing against the Host header
 * (which a page's own JS cannot forge) means an attacker can neither omit Origin
 * nor spoof it to bypass the check.
 *
 * This relies on the reverse proxy forwarding the original Host header — the
 * documented nginx/Caddy configs both do.
 */
export function proxy(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return NextResponse.next();

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  let sameOrigin = false;
  if (origin && host) {
    try {
      sameOrigin = new URL(origin).host === host;
    } catch {
      sameOrigin = false;
    }
  }

  if (!sameOrigin) {
    return NextResponse.json(
      { error: "Cross-site request blocked. Reload the page and try again." },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
