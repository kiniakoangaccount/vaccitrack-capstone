import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect the hidden admin dashboard
  if (pathname.startsWith("/308873d1049ba0/dashboard")) {
    const session = request.cookies.get("admin_session");
    if (!session?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/308873d1049ba0";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect /admin* to 404 — the route doesn't exist publicly
  if (pathname.startsWith("/admin")) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/308873d1049ba0/dashboard/:path*", "/admin/:path*", "/admin"],
};
