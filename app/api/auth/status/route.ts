import { NextResponse } from "next/server";
import { readWorkspace } from "@/lib/workspaceDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const workspace = await readWorkspace();
  return NextResponse.json({ hasWorkspace: workspace.members.length > 0 });
}
