import { NextResponse, type NextRequest } from "next/server";

// Only passes the current path to the admin layout so login can send you back to it.
// The real permission checks happen on the server for every write.
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ["/admin/:path*"] };
