import { NextResponse } from "next/server";
import { sendInviteEmail } from "@/lib/email";
import { getCurrentMember } from "@/lib/session";
import {
  createId,
  isValidEmail,
  normalizeEmail,
  updateWorkspace,
} from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email || "");
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  let link = "";
  let error: string | null = null;

  await updateWorkspace((workspace) => {
    if (workspace.members.some((item) => item.email === email)) {
      error = "That person is already an owner.";
      return;
    }
    workspace.invites = workspace.invites.filter((invite) => invite.email !== email);
    const token = createId() + createId();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    workspace.invites.push({
      token,
      email,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      invitedBy: member.id,
    });
    link = `${origin}/invite/${token}`;
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const emailed = await sendInviteEmail(email, link);
  return NextResponse.json({ email, link, emailed });
}
