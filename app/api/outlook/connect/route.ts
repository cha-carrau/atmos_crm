import { NextResponse } from "next/server";
import { publicUrl, secureCookie } from "@/lib/host";
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
      secure: secureCookie(),
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const code = error instanceof OutlookError ? error.code : "not_configured";
    return NextResponse.redirect(publicUrl(request, `/outlook?error=${code}`));
  }
}
