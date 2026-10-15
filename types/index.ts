// Event type category - determines UI behavior
export type EventTypeCategory = "meeting" | "outbound-message" | "inbound-message";

// Event type definition
export interface EventTypeDefinition {
  id: string;
  name: string;
  category: EventTypeCategory;
  defaultFollowUpDays: number;
  isCustom: boolean;
  createdAt?: string;
}

// Default event types provided by the system
export const DEFAULT_EVENT_TYPES: EventTypeDefinition[] = [
  {
    id: "email",
    name: "Email",
    category: "outbound-message",
    defaultFollowUpDays: 5,
    isCustom: false,
  },
  {
    id: "linkedin-connection",
    name: "LinkedIn Connection Request",
    category: "outbound-message",
    defaultFollowUpDays: 7,
    isCustom: false,
  },
  {
    id: "linkedin-inmail",
    name: "LinkedIn InMail",
    category: "outbound-message",
    defaultFollowUpDays: 7,
    isCustom: false,
  },
  {
    id: "phone-call",
    name: "Phone Call",
    category: "meeting",
    defaultFollowUpDays: 7,
    isCustom: false,
  },
  {
    id: "meeting",
    name: "Meeting",
    category: "meeting",
    defaultFollowUpDays: 14,
    isCustom: false,
  },
  {
    id: "reply-received",
    name: "Reply Received",
    category: "inbound-message",
    defaultFollowUpDays: 2,
    isCustom: false,
  },
  {
    id: "message-received",
    name: "Message Received",
    category: "inbound-message",
    defaultFollowUpDays: 2,
    isCustom: false,
  },
];

// Legacy enum for backward compatibility during migration
export enum EventType {
  LINKEDIN_CONNECTION_REQUEST = "LinkedIn Connection Request",
  LINKEDIN_INMAIL = "LinkedIn InMail",
  EMAIL = "Email",
  MEETING = "Meeting",
  PHONE_CALL = "Phone Call",
  REPLY_RECEIVED = "Reply Received",
}

export type ContactType = "investor" | "client" | "partner" | "hire";

export interface ContactSubtag {
  id: string;
  label: string;
}

export interface ContactTypeDefinition {
  id: ContactType;
  label: string;
  subtagLabel?: string;
  subtags: ContactSubtag[];
}

export const CONTACT_TYPES: ContactTypeDefinition[] = [
  {
    id: "investor",
    label: "Investor",
    subtagLabel: "Investor type",
    subtags: [
      { id: "early-stage", label: "Early-stage" },
      { id: "angel", label: "Angel" },
      { id: "seed", label: "Seed" },
      { id: "series-a", label: "Series A" },
      { id: "series-b", label: "Series B" },
    ],
  },
  {
    id: "client",
    label: "Client",
    subtagLabel: "Client type",
    subtags: [
      { id: "pilot", label: "Pilot" },
      { id: "design-partner", label: "Design partner" },
      { id: "enterprise", label: "Enterprise" },
      { id: "supply-side", label: "Supply-side" },
    ],
  },
  {
    id: "partner",
    label: "Partner",
    subtagLabel: "Partner type",
    subtags: [],
  },
  {
    id: "hire",
    label: "Hire",
    subtagLabel: "Hire type",
    subtags: [],
  },
];

export function getContactTypeDefinition(id?: string) {
  return CONTACT_TYPES.find((type) => type.id === id);
}

export function getSubtagLabel(contactType?: string, subtag?: string) {
  if (!contactType || !subtag) return undefined;
  return getContactTypeDefinition(contactType)?.subtags.find((tag) => tag.id === subtag)?.label;
}

export interface MailingList {
  id: string;
  name: string;
  contactType?: ContactType;
  subtags: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  notes?: string;
  companyId?: string; // Reference to Company
  contactType?: ContactType;
  subtag?: string;
  tags?: string[];
  nextFollowUpDate?: string; // Manual override for follow-up date (ISO string)
  status: "active" | "parked" | "closed"; // Track if person is active, parked, or closed
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  personId: string; // Reference to Person
  date: string; // ISO date string
  time?: string; // Time in HH:MM format
  type: string; // Event type ID (references EventTypeDefinition.id)
  notes?: string;
  externalId?: string; // Outlook message or calendar event id, so a later sync does not import it again
  customFollowUpDays?: number; // Custom override for this specific event's follow-up threshold
  createdAt: string;
  updatedAt: string;
}

// Helper type for follow-up status calculation
export interface FollowUpStatus {
  personId: string;
  lastEvent?: Event;
  lastEventType?: EventTypeDefinition;
  daysSinceLastEvent: number;
  suggestedFollowUpDays: number;
  daysOverdue: number;
  isOverdue: boolean;
  urgency: "critical" | "high" | "medium" | "low" | "none";
  isFutureEvent: boolean;
}

