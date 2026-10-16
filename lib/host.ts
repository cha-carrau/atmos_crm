import path from "path";

export function dataDirectory() {
  const configured = process.env.DATA_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), "data");
}

export function appOrigin(request?: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (!request) return "";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost || request.headers.get("host") || "").split(",")[0].trim();
  const proto = (request.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export function publicUrl(request: Request, pathAndQuery: string) {
  return new URL(pathAndQuery, `${appOrigin(request)}/`);
}

export function secureCookie() {
  const origin = process.env.APP_URL?.trim() || "";
  if (origin.startsWith("https://")) return true;
  if (origin.startsWith("http://")) return false;
  return process.env.NODE_ENV === "production";
}
