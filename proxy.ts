import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("auth-token")?.value;
  const validToken = process.env.AUTH_SECRET;

  const isAuthed = token === validToken;
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isLoginApi = request.nextUrl.pathname.startsWith("/api/login");

  if (!isAuthed && !isLoginPage && !isLoginApi) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
