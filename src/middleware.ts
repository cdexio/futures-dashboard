import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Every page requires BOTH factors before it renders.
 *
 * The matcher is written as an exclusion list rather than a list of protected
 * paths, so a page added tomorrow is protected by default. The opposite —
 * naming what to guard — means a new route is public until somebody remembers
 * it, and nobody remembers it.
 *
 * This is defence in depth, not the only defence: `botFetch` checks the same
 * two facts before it will read anything. A middleware matcher is one typo
 * away from letting a route through, and the data helper is the layer that
 * makes such a typo harmless.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth.js sets one of these depending on whether the deployment is HTTPS.
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (!token) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except: the auth routes themselves, the login and PIN pages,
     * Next's internals and static files. A protected /login would redirect to
     * itself forever.
     */
    "/((?!api/auth|api/pin|login|pin|_next/static|_next/image|favicon.ico|.*\\.svg).*)",
  ],
};
