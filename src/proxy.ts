import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pc_session";
const PROTECTED = ["/admin"];

/**
 * Edge-of-app route protection: bounce signed-out visitors away from account-only pages.
 * This is a fast first gate only — every page/API re-verifies the session and role on the server.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
