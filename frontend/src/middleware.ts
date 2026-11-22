import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROLE_HOME: Record<string, string> = {
  student: "/student",
  staff: "/staff",
  admin: "/admin",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("lf_token")?.value;
  const role = request.cookies.get("lf_role")?.value;

  const isStudentRoute = pathname.startsWith("/student");
  const isStaffRoute = pathname.startsWith("/staff");
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtected = isStudentRoute || isStaffRoute || isAdminRoute;

  if (isProtected) {
    if (!token || !role || !ROLE_HOME[role]) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isStudentRoute && role !== "student") {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
    if (isStaffRoute && role !== "staff") {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
  }

  if ((pathname === "/login" || pathname === "/register") && token && role && ROLE_HOME[role]) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/staff/:path*", "/admin/:path*", "/login", "/register"],
};

