import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { dataDirectory } from "@/lib/host";
import {
  Company,
  Event,
  EventTypeDefinition,
  MailingList,
  Person,
} from "@/types";

export interface Member {
  id: string;
  email: string;
  name: string;
  role: "owner";
  createdAt: string;
}

export interface Invite {
  token: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  invitedBy: string;
}

export interface Session {
  token: string;
  memberId: string;
  createdAt: string;
}

export interface WorkspaceData {
  people: Person[];
  companies: Company[];
  events: Event[];
  customEventTypes: EventTypeDefinition[];
  mailingLists: MailingList[];
}

export interface WorkspaceFile {
  version: number;
  members: Member[];
  invites: Invite[];
  sessions: Session[];
  data: WorkspaceData;
}

const filePath = path.join(dataDirectory(), "workspace.json");

const emptyData = (): WorkspaceData => ({
  people: [],
  companies: [],
  events: [],
  customEventTypes: [],
  mailingLists: [],
});

const emptyWorkspace = (): WorkspaceFile => ({
  version: 1,
  members: [],
  invites: [],
  sessions: [],
  data: emptyData(),
});

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function createId() {
  return randomBytes(12).toString("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readFileWorkspace(): Promise<WorkspaceFile> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as WorkspaceFile;
    return {
      version: parsed.version || 1,
      members: parsed.members || [],
      invites: parsed.invites || [],
      sessions: parsed.sessions || [],
      data: {
        people: parsed.data?.people || [],
        companies: parsed.data?.companies || [],
        events: parsed.data?.events || [],
        customEventTypes: parsed.data?.customEventTypes || [],
        mailingLists: parsed.data?.mailingLists || [],
      },
    };
  } catch {
    return emptyWorkspace();
  }
}

async function writeFileWorkspace(workspace: WorkspaceFile) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(workspace, null, 2));
}

export function readWorkspace() {
  return withLock(() => readFileWorkspace());
}

export function updateWorkspace(mutator: (workspace: WorkspaceFile) => void | WorkspaceFile) {
  return withLock(async () => {
    const workspace = await readFileWorkspace();
    const result = mutator(workspace);
    const next = result || workspace;
    await writeFileWorkspace(next);
    return next;
  });
}
