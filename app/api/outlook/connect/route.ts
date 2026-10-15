import { NextResponse } from "next/server";
import { buildAuthorizeUrl, createOAuthState, OAUTH_STATE_COOKIE, OutlookError } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(buildAuthorizeUrl(state));
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const code = error instanceof OutlookError ? error.code : "not_configured";
    return NextResponse.redirect(new URL(`/outlook?error=${code}`, request.url));
  }
}
