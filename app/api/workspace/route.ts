import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";
import { readWorkspace, updateWorkspace, WorkspaceData } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const workspace = await readWorkspace();
  return NextResponse.json({
    version: workspace.version,
    ...workspace.data,
  });
}

export async function PUT(request: Request) {
  const member = await getCurrentMember();
  if (!member) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as WorkspaceData | null;
  if (!body || !Array.isArray(body.people) || !Array.isArray(body.companies) || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "Invalid workspace data." }, { status: 400 });
  }

  const workspace = await updateWorkspace((current) => {
    current.version += 1;
    current.data = {
      people: body.people || [],
      companies: body.companies || [],
      events: body.events || [],
      customEventTypes: body.customEventTypes || [],
      mailingLists: body.mailingLists || [],
    };
  });

  return NextResponse.json({ version: workspace.version });
}
