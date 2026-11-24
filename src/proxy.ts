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
  // OSM's web tile servers require a Referer header. strict-origin sends only
  // this site's origin, avoiding the hidden admin path while satisfying that.
  response.headers.set("Referrer-Policy", "strict-origin");
  return response;
}

export const config = {
  matcher: ["/vaccitrack_super_hidden_admin/dashboard/:path*", "/admin/:path*", "/admin"],
};
