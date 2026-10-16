import { cookies } from "next/headers";
import { secureCookie } from "@/lib/host";
import { Member, readWorkspace } from "@/lib/workspaceDb";

export const SESSION_COOKIE = "atmosone_session";

export async function readSessionToken() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

export async function writeSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentMember(): Promise<Member | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const workspace = await readWorkspace();
  const session = workspace.sessions.find((item) => item.token === token);
  if (!session) return null;
  return workspace.members.find((member) => member.id === session.memberId) || null;
}
