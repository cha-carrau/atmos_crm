import { NextResponse } from "next/server";
import { clearSessionCookie, readSessionToken } from "@/lib/session";
import { updateWorkspace } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = await readSessionToken();
  if (token) {
    await updateWorkspace((workspace) => {
      workspace.sessions = workspace.sessions.filter((session) => session.token !== token);
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
