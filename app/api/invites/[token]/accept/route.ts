import { NextResponse } from "next/server";
import { writeSessionCookie } from "@/lib/session";
import { createId, updateWorkspace } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();

  let error: string | null = null;
  let status = 400;
  let sessionToken = "";

  await updateWorkspace((workspace) => {
    const invite = workspace.invites.find((item) => item.token === token);
    if (!invite) {
      error = "This invite is no longer valid.";
      status = 404;
      return;
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      error = "This invite has expired.";
      status = 410;
      return;
    }

    let member = workspace.members.find((item) => item.email === invite.email);
    if (!member) {
      member = {
        id: createId(),
        email: invite.email,
        name: name || invite.email.split("@")[0],
        role: "owner",
        createdAt: new Date().toISOString(),
      };
      workspace.members.push(member);
    } else if (name) {
      member.name = name;
    }

    sessionToken = createId() + createId();
    workspace.sessions = workspace.sessions.filter((session) => session.memberId !== member!.id);
    workspace.sessions.push({
      token: sessionToken,
      memberId: member.id,
      createdAt: new Date().toISOString(),
    });
    workspace.invites = workspace.invites.filter((item) => item.token !== token);
  });

  if (error || !sessionToken) {
    return NextResponse.json({ error: error || "Could not accept invite." }, { status });
  }

  await writeSessionCookie(sessionToken);
  return NextResponse.json({ ok: true });
}
