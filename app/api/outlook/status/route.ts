import { getOutlookStatus } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getOutlookStatus();
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
