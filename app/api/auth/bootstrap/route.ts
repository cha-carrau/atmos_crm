import { NextResponse } from "next/server";
import {
  createId,
  isValidEmail,
  normalizeEmail,
  updateWorkspace,
  WorkspaceData,
} from "@/lib/workspaceDb";
import { writeSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email || "");
  const name = String(body?.name || "").trim();
  const imported = body?.data as WorkspaceData | undefined;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  let created = false;
  const workspace = await updateWorkspace((current) => {
    if (current.members.length > 0) return current;
    const memberId = createId();
    const sessionToken = createId() + createId();
    current.members.push({
      id: memberId,
      email,
      name,
      role: "owner",
      createdAt: new Date().toISOString(),
    });
    current.sessions.push({
      token: sessionToken,
      memberId,
      createdAt: new Date().toISOString(),
    });
    if (imported) {
      current.data = {
        people: imported.people || [],
        companies: imported.companies || [],
        events: imported.events || [],
        customEventTypes: imported.customEventTypes || [],
        mailingLists: imported.mailingLists || [],
      };
    }
    created = true;
    return current;
  });

  if (!created) {
    return NextResponse.json(
      { error: "This workspace already has an owner. Ask them for an invite." },
      { status: 409 }
    );
  }

  const session = workspace.sessions[workspace.sessions.length - 1];
  await writeSessionCookie(session.token);
  const member = workspace.members[0];
  return NextResponse.json({ member });
}
