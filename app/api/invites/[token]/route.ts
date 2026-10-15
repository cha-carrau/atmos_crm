import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";
import { readWorkspace, updateWorkspace } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const workspace = await readWorkspace();
  const invite = workspace.invites.find((item) => item.token === token);
  if (!invite) {
    return NextResponse.json({ error: "This invite is no longer valid." }, { status: 404 });
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
  }
  return NextResponse.json({ email: invite.email, expiresAt: invite.expiresAt });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { token } = await context.params;
  await updateWorkspace((workspace) => {
    workspace.invites = workspace.invites.filter((invite) => invite.token !== token);
  });
  return NextResponse.json({ ok: true });
}
