import { type NextRequest, NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/auth";

export const POST = (_request: NextRequest) => {
  const response = NextResponse.json({ ok: true });
  // Clear both the HttpOnly server-set cookie and the legacy client-set cookie.
  response.cookies.set(TOKEN_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
  });
  return response;
};
