import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";
import { readWorkspace } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const workspace = await readWorkspace();
  return NextResponse.json({
    member,
    members: workspace.members.map(({ id, email, name, role, createdAt }) => ({
      id,
      email,
      name,
      role,
      createdAt,
    })),
    invites: workspace.invites.map(({ token, email, createdAt, expiresAt }) => ({
      token,
      email,
      createdAt,
      expiresAt,
    })),
  });
}
