import { OutlookError, sanitizeExisting, sanitizePeople, syncOutlook } from "@/lib/outlook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { people?: unknown; existingExternalIds?: unknown } | null;
    const result = await syncOutlook({
      people: sanitizePeople(body?.people),
      existing: sanitizeExisting(body?.existingExternalIds),
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OutlookError) {
      return Response.json(
        { error: error.message, missingEnv: error.missing ?? [] },
        { status: error.status, headers: { "Cache-Control": "no-store" } }
      );
    }
    return Response.json({ error: "Outlook sync failed." }, { status: 500 });
  }
}
