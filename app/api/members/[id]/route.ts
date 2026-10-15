import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";
import { updateWorkspace } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  if (id === member.id) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }

  let error: string | null = null;
  await updateWorkspace((workspace) => {
    if (workspace.members.length <= 1) {
      error = "The workspace needs at least one owner.";
      return;
    }
    const target = workspace.members.find((item) => item.id === id);
    if (!target) {
      error = "Member not found.";
      return;
    }
    workspace.members = workspace.members.filter((item) => item.id !== id);
    workspace.sessions = workspace.sessions.filter((session) => session.memberId !== id);
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
