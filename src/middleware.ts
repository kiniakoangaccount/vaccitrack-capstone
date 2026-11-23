import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPER_ADMIN_PATH = "/308873d1049ba0";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  const isSuperAdminPath = pathname === SUPER_ADMIN_PATH || pathname.startsWith(`${SUPER_ADMIN_PATH}/`);
  if (!isSuperAdminPath) return NextResponse.next();

  let response: NextResponse;
  if (pathname === `${SUPER_ADMIN_PATH}/dashboard` || pathname.startsWith(`${SUPER_ADMIN_PATH}/dashboard/`)) {
    const session = request.cookies.get("admin_session");
    if (!session?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = SUPER_ADMIN_PATH;
      loginUrl.search = "";
      response = NextResponse.redirect(loginUrl);
    } else {
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/308873d1049ba0", "/308873d1049ba0/:path*", "/admin/:path*", "/admin"],
};
