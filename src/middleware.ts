import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Three jobs, none of which decides access on its own.
 *
 *   1. DEVICE COOKIE. Every browser gets a random `cdx_device` on its first
 *      visit, and it is copied into a request header on every visit after.
 *      Minted here because the middleware is the one place that runs before
 *      the first page render AND can set a cookie; a server component cannot.
 *   2. PATHNAME. Passed to the root layout, which uses it to send each request
 *      to the step it is missing — login, device approval, or PIN.
 *   3. NO SESSION COOKIE, NO PAGE. The cheap early exit, as before.
 *
 * The real checks — a signed-in session, an approved device, a fresh PIN —
 * run in Node (src/lib/access.ts), in the layout and again in `botFetch`.
 * The edge runtime cannot read the device registry off disk, and a check that
 * lives only in a matcher is one typo away from letting a route through.
 *
 * The matcher is an exclusion list, so a page added tomorrow is covered by
 * default. The pages that exist to GET access are matched too — they need the
 * device cookie — and let through by `PUBLIC` below instead.
 */

const DEVICE_COOKIE = "cdx_device";
const DEVICE_HEADER = "x-cdx-device";
const PATH_HEADER = "x-pathname";
const PUBLIC = ["/login", "/pin", "/device", "/api/pin"];

function mintDeviceToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const existing = request.cookies.get(DEVICE_COOKIE)?.value;
  const device = existing && /^[A-Za-z0-9_-]{43}$/.test(existing) ? existing : mintDeviceToken();

  const remember = (response: NextResponse) => {
    if (device !== existing) {
      response.cookies.set(DEVICE_COOKIE, device, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        // 400 days, the most a browser will keep a cookie. Losing this is
        // losing the device, so it is kept as long as it can be.
        maxAge: 400 * 24 * 60 * 60,
      });
    }
    return response;
  };

  // Auth.js sets one of these depending on whether the deployment is HTTPS.
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  const isPublic = PUBLIC.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!token && !isPublic) {
    // A fetch that follows a redirect to /login gets a 200 of HTML, which the
    // session guard and the polled cards would read as "still fine". An API
    // call is told plainly instead.
    if (pathname.startsWith("/api/")) {
      return remember(NextResponse.json({ step: "login", redirect: "/login" }, { status: 401 }));
    }
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return remember(NextResponse.redirect(login));
  }

  // Always SET, never passed through: a header the client sent under this
  // name is overwritten, so nothing downstream can be handed a device id or a
  // path that did not come from here.
  const forwarded = new Headers(request.headers);
  forwarded.set(DEVICE_HEADER, device);
  forwarded.set(PATH_HEADER, pathname);
  return remember(NextResponse.next({ request: { headers: forwarded } }));
}

export const config = {
  matcher: [
    /*
     * Everything except: Auth.js's own routes, Next's internals, and the
     * files a browser fetches WITHOUT cookies — the favicon, the manifest and
     * the home-screen icons. A protected manifest is a redirect to /login,
     * and a phone that gets a redirect installs a bookmark with no icon.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|.*\\.svg).*)",
  ],
};
