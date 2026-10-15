import { disconnectOutlook } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await disconnectOutlook();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
