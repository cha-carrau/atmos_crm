import { Company, Event, EventTypeDefinition, MailingList, Person } from "@/types";

export interface WorkspaceSnapshot {
  version: number;
  people: Person[];
  companies: Company[];
  events: Event[];
  customEventTypes: EventTypeDefinition[];
  mailingLists: MailingList[];
}

let dirty = false;
let saving = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let readState: (() => WorkspaceSnapshot) | null = null;
let writeState: ((snapshot: WorkspaceSnapshot) => void) | null = null;
let writeVersion: ((version: number) => void) | null = null;

export function bindStore(
  read: () => WorkspaceSnapshot,
  write: (snapshot: WorkspaceSnapshot) => void,
  setVersion: (version: number) => void
) {
  readState = read;
  writeState = write;
  writeVersion = setVersion;
}

export function markDirty() {
  dirty = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void flush();
  }, 300);
}

export function isSyncBusy() {
  return dirty || saving;
}

async function flush() {
  if (!readState || saving) return;
  saving = true;
  const snapshot = readState();
  dirty = false;
  try {
    const response = await fetch("/api/workspace", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    if (response.ok) {
      const body = await response.json();
      if (!dirty) writeVersion?.(body.version);
    } else {
      dirty = true;
    }
  } catch {
    dirty = true;
  } finally {
    saving = false;
    if (dirty) void flush();
  }
}

export async function pullWorkspace() {
  if (!readState || !writeState || isSyncBusy()) return;
  const response = await fetch("/api/workspace", { credentials: "include" });
  if (!response.ok) return;
  const snapshot = (await response.json()) as WorkspaceSnapshot;
  if (isSyncBusy()) return;
  if (snapshot.version === readState().version) return;
  writeState(snapshot);
}
