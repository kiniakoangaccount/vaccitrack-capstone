import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const SUPER_ADMIN_PATH = "/vaccitrack_super_hidden_admin";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect the hidden admin dashboard
  if (pathname.startsWith("/vaccitrack_super_hidden_admin/dashboard")) {
    const session = request.cookies.get("admin_session");
    if (!session?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/vaccitrack_super_hidden_admin";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect /admin* to 404 — the route doesn't exist publicly
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
  matcher: ["/vaccitrack_super_hidden_admin/dashboard/:path*", "/admin/:path*", "/admin"],
};
