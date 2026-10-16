import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { publicUrl, secureCookie } from "@/lib/host";
import { exchangeAuthorizationCode, OAUTH_STATE_COOKIE } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearAndRedirect(request: Request, path: string) {
  const response = NextResponse.redirect(publicUrl(request, path));
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const code = /^[a-z0-9_]+$/i.test(oauthError) ? oauthError : "oauth";
    const target = publicUrl(request, "/outlook");
    target.searchParams.set("error", code);
    const detail = url.searchParams.get("error_description");
    if (detail) {
      target.searchParams.set("detail", detail.replace(/\s+/g, " ").trim().slice(0, 180));
    }
    return clearAndRedirect(request, `${target.pathname}${target.search}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return clearAndRedirect(request, "/outlook?error=missing_code");
  if (!state || !expected || state !== expected) {
    return clearAndRedirect(request, "/outlook?error=invalid_state");
  }

  try {
    await exchangeAuthorizationCode(code);
    return clearAndRedirect(request, "/outlook?connected=1");
  } catch (error) {
    const detail = error instanceof Error ? error.message.replace(/\s+/g, " ").trim().slice(0, 180) : "";
    const target = publicUrl(request, "/outlook");
    target.searchParams.set("error", "token_exchange");
    if (detail) target.searchParams.set("detail", detail);
    return clearAndRedirect(request, `${target.pathname}${target.search}`);
  }
}
