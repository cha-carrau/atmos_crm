import { existsSync } from "fs";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { dataDirectory } from "@/lib/host";
import {
  CrmPersonRef,
  ExistingExternalRef,
  matchOutlookImport,
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_SCOPES,
  OutlookConnectionStatus,
  OutlookContact,
  OutlookMeeting,
  OutlookMessage,
  OutlookParticipant,
  OutlookSyncSummary,
  parseInstant,
} from "@/lib/outlookMatch";

const DATA_DIR = dataDirectory();
const TOKEN_PATH = path.join(DATA_DIR, "outlook-tokens.json");
const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

export const OAUTH_STATE_COOKIE = "outlook_oauth_state";

export class OutlookError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "not_connected" | "graph" | "oauth",
    readonly status: number,
    readonly missing?: string[]
  ) {
    super(message);
    this.name = "OutlookError";
  }
}

interface OutlookConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

interface OutlookTokenFile {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  accountEmail?: string;
  accountName?: string;
  accountEmails?: string[];
  connectedAt?: string;
  lastSyncAt?: string;
  lastSync?: OutlookSyncSummary | null;
}

export function createOAuthState() {
  return randomBytes(24).toString("hex");
}

export function getOutlookConfig(): { config?: OutlookConfig; missing: string[]; redirectUri: string } {
  const missing: string[] = [];
  const clientId = process.env.AZURE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim() || "";
  const tenantId = process.env.AZURE_TENANT_ID?.trim() || "";
  if (!clientId) missing.push("AZURE_CLIENT_ID");
  if (!clientSecret) missing.push("AZURE_CLIENT_SECRET");
  if (!tenantId) missing.push("AZURE_TENANT_ID");
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");
  const redirectUri =
    process.env.AZURE_REDIRECT_URI?.trim() ||
    (appUrl ? `${appUrl}/api/outlook/callback` : OUTLOOK_REDIRECT_URI);
  if (missing.length) return { missing, redirectUri };
  return {
    missing,
    redirectUri,
    config: { clientId, clientSecret, tenantId, redirectUri },
  };
}

function requireConfig() {
  const result = getOutlookConfig();
  if (!result.config) {
    throw new OutlookError(
      `Outlook is not configured. Set ${result.missing.join(", ")} in .env.local and restart the dev server.`,
      "not_configured",
      400,
      result.missing
    );
  }
  return result.config;
}

export function buildAuthorizeUrl(state: string) {
  const config = requireConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: OUTLOOK_SCOPES,
    state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize?${params}`;
}

function safeError(text: string, secret?: string) {
  let output = text.replace(/\s+/g, " ").trim();
  if (secret && secret.length > 4) output = output.split(secret).join("[secret]");
  return output.slice(0, 180);
}

async function requestToken(config: OutlookConfig, body: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    }
  );
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
    error_description?: unknown;
  };
  if (!response.ok || typeof json.access_token !== "string") {
    const description =
      typeof json.error_description === "string" ? json.error_description : "Microsoft token request failed.";
    throw new OutlookError(safeError(description, config.clientSecret), "oauth", 502);
  }
  return {
    access_token: json.access_token,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    scope: typeof json.scope === "string" ? json.scope : undefined,
  };
}

async function readTokenFile(): Promise<OutlookTokenFile | null> {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    const raw = await readFile(TOKEN_PATH, "utf8");
    const parsed = JSON.parse(raw) as OutlookTokenFile;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeTokenFile(data: OutlookTokenFile) {
  await mkdir(DATA_DIR, { recursive: true });
  const temporary = `${TOKEN_PATH}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
  await rename(temporary, TOKEN_PATH);
}

export async function getOutlookStatus(): Promise<OutlookConnectionStatus> {
  const { missing, redirectUri } = getOutlookConfig();
  const file = await readTokenFile();
  const connected = Boolean(file?.refreshToken);
  return {
    configured: missing.length === 0,
    missingEnv: missing,
    redirectUri,
    connected,
    accountEmail: connected ? file?.accountEmail : undefined,
    accountName: connected ? file?.accountName : undefined,
    lastSyncAt: file?.lastSyncAt ?? null,
    lastSync: file?.lastSync ?? null,
  };
}

export async function disconnectOutlook() {
  const current = await readTokenFile();
  if (!current) return;
  await writeTokenFile({
    lastSyncAt: current.lastSyncAt,
    lastSync: current.lastSync ?? null,
  });
}

async function refreshAccessToken(file: OutlookTokenFile) {
  const config = requireConfig();
  if (!file.refreshToken) {
    throw new OutlookError("Connect Outlook before syncing.", "not_connected", 401);
  }
  try {
    const token = await requestToken(
      config,
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: file.refreshToken,
        scope: OUTLOOK_SCOPES,
      })
    );
    const next: OutlookTokenFile = {
      ...file,
      accessToken: token.access_token,
      refreshToken: token.refresh_token || file.refreshToken,
      expiresAt: Date.now() + token.expires_in * 1000,
      scope: token.scope || file.scope,
    };
    await writeTokenFile(next);
    return next;
  } catch (error) {
    if (error instanceof OutlookError && error.code === "not_configured") throw error;
    const detail = error instanceof Error ? safeError(error.message, config.clientSecret) : "";
    throw new OutlookError(
      detail
        ? `Outlook access expired. Connect your account again. ${detail}`
        : "Outlook access expired. Connect your account again.",
      "not_connected",
      401
    );
  }
}

async function ensureAccessToken() {
  const file = await readTokenFile();
  if (!file?.refreshToken) {
    throw new OutlookError("Connect Outlook before syncing.", "not_connected", 401);
  }
  if (file.accessToken && file.expiresAt && file.expiresAt > Date.now() + 60_000) return file;
  return refreshAccessToken(file);
}

class GraphClient {
  private refreshed = false;

  constructor(private tokenFile: OutlookTokenFile) {}

  currentFile() {
    return this.tokenFile;
  }

  private async fetchOnce(url: string, headers?: Record<string, string>) {
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${this.tokenFile.accessToken}`,
        ...headers,
      },
      cache: "no-store",
    });
  }

  async get(url: string, headers?: Record<string, string>) {
    let response = await this.fetchOnce(url, headers);
    if (response.status === 401 && !this.refreshed) {
      this.tokenFile = await refreshAccessToken(this.tokenFile);
      this.refreshed = true;
      response = await this.fetchOnce(url, headers);
    }
    if (response.status === 401) {
      throw new OutlookError("Outlook access expired. Connect your account again.", "not_connected", 401);
    }
    if (!response.ok) {
      const text = await response.text();
      const compact = text.replace(/\s+/g, " ").trim();
      const detail = !compact || compact.startsWith("<") ? "" : ` ${compact.slice(0, 160)}`;
      throw new OutlookError(`Microsoft Graph returned ${response.status}.${detail}`, "graph", 502);
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function graphDateToIso(value: unknown) {
  return parseInstant(asString(value))?.toISOString();
}

function mapAddress(value: unknown): OutlookParticipant | undefined {
  const record = asRecord(value);
  const emailAddress = asRecord(record?.emailAddress);
  const name = asString(emailAddress?.name);
  const address = asString(emailAddress?.address);
  if (!name && !address) return undefined;
  return { name, address };
}

function mapMessage(value: unknown, folder: "mailbox" | "sent"): OutlookMessage | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  if (!record || !id || record.isDraft === true) return null;
  const to = Array.isArray(record.toRecipients)
    ? record.toRecipients.map(mapAddress).filter((item): item is OutlookParticipant => Boolean(item))
    : [];
  const cc = Array.isArray(record.ccRecipients)
    ? record.ccRecipients.map(mapAddress).filter((item): item is OutlookParticipant => Boolean(item))
    : [];
  return {
    id,
    subject: asString(record.subject),
    from: mapAddress(record.from),
    to,
    cc,
    receivedAt: graphDateToIso(record.receivedDateTime),
    preview: asString(record.bodyPreview),
    folder,
  };
}

function mapMeeting(value: unknown): OutlookMeeting | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  if (!record || !id || record.isCancelled === true) return null;
  const start = asRecord(record.start);
  const end = asRecord(record.end);
  const attendees = Array.isArray(record.attendees)
    ? record.attendees
        .filter((item) => asRecord(item)?.type !== "resource")
        .map(mapAddress)
        .filter((item): item is OutlookParticipant => Boolean(item))
    : [];
  return {
    id,
    subject: asString(record.subject),
    start: graphDateToIso(start?.dateTime),
    end: graphDateToIso(end?.dateTime),
    organizer: mapAddress(record.organizer),
    attendees,
  };
}

function mapContact(value: unknown): OutlookContact | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  if (!record || !id) return null;
  const addresses = Array.isArray(record.emailAddresses) ? record.emailAddresses : [];
  const email = addresses.map((item) => asString(asRecord(item)?.address)).find(Boolean);
  const name = asString(record.displayName);
  if (!name && !email) return null;
  return {
    id,
    name,
    email,
    jobTitle: asString(record.jobTitle),
    companyName: asString(record.companyName),
  };
}

const MAIL_LOOKBACK_MS = 180 * 24 * 60 * 60 * 1000;
const MAIL_PAGE_CAP = 250;

function messageUrl(folder?: "sentitems", since?: string) {
  const pathname = folder ? `/me/mailFolders/${folder}/messages` : "/me/messages";
  const params = new URLSearchParams();
  params.set("$top", "50");
  params.set(
    "$select",
    "id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,isDraft"
  );
  params.set("$orderby", "receivedDateTime desc");
  if (since) params.set("$filter", `receivedDateTime ge ${since}`);
  return `${GRAPH_ROOT}${pathname}?${params}`;
}

function mapMessagePage(items: unknown[], folder: "mailbox" | "sent") {
  return items.map((item) => mapMessage(item, folder)).filter((item): item is OutlookMessage => Boolean(item));
}

async function fetchMessages(client: GraphClient, folder: "mailbox" | "sent") {
  const graphFolder = folder === "sent" ? "sentitems" : undefined;
  const since = new Date(Date.now() - MAIL_LOOKBACK_MS).toISOString();
  try {
    const items = await collectPages(client, messageUrl(graphFolder, since), undefined, MAIL_PAGE_CAP);
    return mapMessagePage(items, folder);
  } catch (error) {
    if (error instanceof OutlookError && (error.code === "not_connected" || error.code === "not_configured")) {
      throw error;
    }
    const page = await client.get(messageUrl(graphFolder));
    return mapMessagePage(Array.isArray(page.value) ? page.value : [], folder);
  }
}

async function collectPages(
  client: GraphClient,
  url: string,
  headers: Record<string, string> | undefined,
  maxItems: number
) {
  const items: unknown[] = [];
  let next: string | undefined = url;
  while (next && items.length < maxItems) {
    const page = await client.get(next, headers);
    if (Array.isArray(page.value)) items.push(...page.value);
    next = typeof page["@odata.nextLink"] === "string" ? page["@odata.nextLink"] : undefined;
  }
  return items.slice(0, maxItems);
}

function mergeMessages(groups: OutlookMessage[][]) {
  const merged = new Map<string, OutlookMessage>();
  for (const group of groups) {
    for (const message of group) {
      const existing = merged.get(message.id);
      if (!existing) {
        merged.set(message.id, message);
        continue;
      }
      if (message.folder === "sent") existing.folder = "sent";
    }
  }
  return [...merged.values()];
}

async function tryStep<T>(label: string, fn: () => Promise<T>, warnings: string[], fallback: T) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof OutlookError && (error.code === "not_connected" || error.code === "not_configured")) {
      throw error;
    }
    const message = error instanceof Error ? error.message : `${label} failed.`;
    warnings.push(`${label}: ${message}`);
    return fallback;
  }
}

export function sanitizePeople(value: unknown): CrmPersonRef[] {
  if (!Array.isArray(value)) return [];
  const people: CrmPersonRef[] = [];
  for (const item of value.slice(0, 5000)) {
    const record = asRecord(item);
    const id = asString(record?.id);
    const name = asString(record?.name);
    if (!id || !name) continue;
    people.push({
      id,
      name,
      email: asString(record?.email),
      secondaryEmail: asString(record?.secondaryEmail),
    });
  }
  return people;
}

export function sanitizeExisting(value: unknown): ExistingExternalRef[] {
  if (!Array.isArray(value)) return [];
  const existing: ExistingExternalRef[] = [];
  for (const item of value.slice(0, 20000)) {
    const record = asRecord(item);
    const personId = asString(record?.personId);
    const externalId = asString(record?.externalId);
    if (!personId || !externalId?.startsWith("outlook-")) continue;
    existing.push({ personId, externalId });
  }
  return existing;
}

export async function exchangeAuthorizationCode(code: string) {
  const config = requireConfig();
  const token = await requestToken(
    config,
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      scope: OUTLOOK_SCOPES,
    })
  );
  if (!token.refresh_token) {
    throw new OutlookError(
      "Microsoft did not return a refresh token. Include the offline_access permission and connect again.",
      "oauth",
      502
    );
  }

  const client = new GraphClient({ accessToken: token.access_token, refreshToken: token.refresh_token });
  const me = await client.get(`${GRAPH_ROOT}/me?$select=displayName,mail,userPrincipalName`);
  const accountEmails = [asString(me.mail), asString(me.userPrincipalName)].filter(
    (email): email is string => Boolean(email)
  );
  const previous = await readTokenFile();
  await writeTokenFile({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope,
    accountEmail: accountEmails[0],
    accountName: asString(me.displayName),
    accountEmails,
    connectedAt: new Date().toISOString(),
    lastSyncAt: previous?.lastSyncAt,
    lastSync: previous?.lastSync ?? null,
  });
}

export async function syncOutlook(input: { people: CrmPersonRef[]; existing: ExistingExternalRef[] }) {
  requireConfig();
  const tokenFile = await ensureAccessToken();
  const client = new GraphClient(tokenFile);
  const warnings: string[] = [];

  const mailbox = await tryStep("Recent mail", () => fetchMessages(client, "mailbox"), warnings, []);
  const sent = await tryStep("Sent mail", () => fetchMessages(client, "sent"), warnings, []);
  const messages = mergeMessages([mailbox, sent]);

  const end = new Date();
  const start = new Date(end.getTime() - 180 * 24 * 60 * 60 * 1000);
  const calendarParams = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
  });
  calendarParams.set("$top", "100");
  calendarParams.set("$select", "id,subject,start,end,organizer,attendees,isCancelled");
  const meetingItems = await tryStep(
    "Calendar",
    () =>
      collectPages(client, `${GRAPH_ROOT}/me/calendarView?${calendarParams}`, { Prefer: 'outlook.timezone="UTC"' }, 250),
    warnings,
    []
  );
  const meetings = meetingItems.map(mapMeeting).filter((item): item is OutlookMeeting => Boolean(item));

  const contactParams = new URLSearchParams();
  contactParams.set("$top", "100");
  contactParams.set("$select", "id,displayName,emailAddresses,jobTitle,companyName");
  const contactItems = await tryStep(
    "Contacts",
    () => collectPages(client, `${GRAPH_ROOT}/me/contacts?${contactParams}`, undefined, 200),
    warnings,
    []
  );
  const contacts = contactItems.map(mapContact).filter((item): item is OutlookContact => Boolean(item));

  if (messages.length === 0 && meetings.length === 0 && contacts.length === 0 && warnings.length > 0) {
    throw new OutlookError(warnings[0], "graph", 502);
  }

  const matched = matchOutlookImport({
    meEmails: tokenFile.accountEmails || (tokenFile.accountEmail ? [tokenFile.accountEmail] : []),
    people: input.people,
    existing: input.existing,
    messages,
    meetings,
    contacts,
    now: end,
  });

  const summary: OutlookSyncSummary = {
    messagesRead: messages.length,
    meetingsRead: meetings.length,
    contactsRead: contacts.length,
    matchedEvents: matched.events.length,
    skippedDuplicates: matched.skippedDuplicates,
    skippedFutureMeetings: matched.skippedFutureMeetings,
    suggestedContacts: matched.suggestions.length,
  };
  const syncedAt = new Date().toISOString();
  const latestTokens = client.currentFile();
  await writeTokenFile({
    ...latestTokens,
    lastSyncAt: syncedAt,
    lastSync: summary,
  });

  return {
    events: matched.events,
    suggestions: matched.suggestions,
    summary,
    warnings,
    syncedAt,
    accountEmail: latestTokens.accountEmail,
  };
}
