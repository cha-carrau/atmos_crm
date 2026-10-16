import assert from "node:assert/strict";
import {
  buildAtmosoneData,
  mergeAtmosoneData,
  parseAtmosoneData,
  type WorkspaceData,
} from "../lib/dataExchange";
import type { ContactTagCatalog } from "../utils/contactSubtags";

const catalog: ContactTagCatalog = {
  byType: { investor: [{ id: "growth", label: "Growth" }] },
  customTypes: [],
};

const current: WorkspaceData = {
  companies: [
    {
      id: "co-atmos",
      name: "AtmosOne",
      notes: "Charlotte's notes",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  people: [
    {
      id: "p-ada",
      name: "Ada Lovelace",
      email: "ada@atmosone.com",
      jobTitle: "CEO",
      notes: "Keep this note",
      companyId: "co-atmos",
      contactType: "investor",
      tags: ["VIP"],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "p-only",
      name: "Only Mine",
      email: "only@atmosone.com",
      notes: "Do not delete",
      status: "parked",
      tags: [],
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    {
      id: "p-sam-1",
      name: "Sam Lee",
      status: "active",
      tags: [],
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    },
    {
      id: "p-sam-2",
      name: "Sam Lee",
      status: "active",
      tags: [],
      createdAt: "2026-01-04T00:00:00.000Z",
      updatedAt: "2026-01-04T00:00:00.000Z",
    },
    {
      id: "p-grace",
      name: "Grace Hopper",
      status: "active",
      tags: [],
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "p-collide",
      name: "Alice",
      email: "alice@atmosone.com",
      status: "active",
      tags: [],
      createdAt: "2026-01-06T00:00:00.000Z",
      updatedAt: "2026-01-06T00:00:00.000Z",
    },
  ],
  events: [
    {
      id: "ev-ada-old",
      personId: "p-ada",
      date: "2026-02-01",
      type: "email",
      notes: "Charlotte's message",
      externalId: "outlook-1",
      createdAt: "2026-02-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
  ],
  mailingLists: [
    {
      id: "list-investors",
      name: "Investors",
      contactType: "investor",
      subtags: ["seed"],
      tags: ["a"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  customEventTypes: [],
};

const incoming = buildAtmosoneData(
  {
    companies: [
      {
        id: "their-co",
        name: " atmosone ",
        notes: "Their notes should not replace hers",
        websiteUrl: "https://atmosone.com",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "their-newco",
        name: "NewCo",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ],
    people: [
      {
        id: "their-ada",
        name: "Ada Lovelace",
        email: "ada.other@atmosone.com",
        secondaryEmail: "ADA@atmosone.com",
        jobTitle: "Intern",
        notes: "Incoming note",
        linkedinUrl: "https://linkedin.com/in/ada",
        contactType: "client",
        subtag: "pilot",
        tags: ["vip", "warm"],
        companyId: "their-co",
        status: "closed",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "their-bea",
        name: "Bea",
        email: "bea@newco.com",
        companyId: "their-newco",
        notes: "Met at the demo",
        contactType: "partner",
        tags: ["demo"],
        status: "active",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
      {
        id: "their-grace",
        name: "grace hopper",
        jobTitle: "Advisor",
        status: "active",
        tags: [],
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      },
      {
        id: "their-sam",
        name: "Sam Lee",
        notes: "Ambiguous",
        status: "active",
        tags: [],
        createdAt: "2026-03-04T00:00:00.000Z",
        updatedAt: "2026-03-04T00:00:00.000Z",
      },
      {
        id: "p-collide",
        name: "Bob",
        email: "bob@newco.com",
        status: "active",
        tags: [],
        createdAt: "2026-03-05T00:00:00.000Z",
        updatedAt: "2026-03-05T00:00:00.000Z",
      },
    ],
    events: [
      {
        id: "ev-dup-id",
        personId: "their-ada",
        date: "2026-02-01",
        type: "email",
        notes: "Should not replace",
        externalId: "outlook-1",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "ev-ada-old",
        personId: "their-ada",
        date: "2026-02-02",
        type: "meeting",
        notes: "Same id, leave Charlotte's event",
        createdAt: "2026-02-02T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      },
      {
        id: "ev-ada-new",
        personId: "their-ada",
        date: "2026-04-01",
        type: "reply-received",
        notes: "New reply",
        externalId: "outlook-2",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "ev-bea",
        personId: "their-bea",
        date: "2026-04-02",
        type: "custom-whatsapp",
        notes: "WhatsApp hello",
        createdAt: "2026-04-02T00:00:00.000Z",
        updatedAt: "2026-04-02T00:00:00.000Z",
      },
      {
        id: "ev-bob",
        personId: "p-collide",
        date: "2026-04-03",
        type: "email",
        notes: "Bob's email",
        createdAt: "2026-04-03T00:00:00.000Z",
        updatedAt: "2026-04-03T00:00:00.000Z",
      },
    ],
    mailingLists: [
      {
        id: "their-investors",
        name: "investors",
        tags: ["b"],
        subtags: ["seed", "angel"],
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "their-newsletter",
        name: "Newsletter",
        contactType: "client",
        tags: ["monthly"],
        subtags: [],
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ],
    customEventTypes: [
      {
        id: "custom-whatsapp",
        name: "WhatsApp",
        category: "outbound-message",
        defaultFollowUpDays: 3,
        isCustom: true,
      },
      {
        id: "custom-email-alias",
        name: "Email",
        category: "outbound-message",
        defaultFollowUpDays: 1,
        isCustom: true,
      },
    ],
  },
  {
    byType: {
      investor: [
        { id: "growth", label: "Growth" },
        { id: "family-office", label: "Family office" },
      ],
      advisor: [{ id: "technical", label: "Technical" }],
    },
    customTypes: [{ id: "advisor", label: "Advisor", subtagLabel: "Advisor type", subtags: [] }],
  }
);

const parsed = parseAtmosoneData(JSON.stringify(incoming));
const merged = mergeAtmosoneData(current, catalog, parsed);

assert.deepEqual(merged.summary, {
  people: { added: 3, updated: 2 },
  companies: { added: 1, updated: 1 },
  lists: { added: 1, updated: 1 },
  events: { added: 3, updated: 0 },
  contactTypesAdded: 1,
  subtagsAdded: 2,
  eventTypesAdded: 1,
});

assert.equal(merged.people.length, current.people.length + 3);
assert.ok(merged.people.some((person) => person.id === "p-only" && person.notes === "Do not delete"));
assert.ok(merged.people.some((person) => person.email === "only@atmosone.com" && person.status === "parked"));

const ada = merged.people.find((person) => person.id === "p-ada");
assert.ok(ada);
assert.equal(ada.email, "ada@atmosone.com");
assert.equal(ada.secondaryEmail, "ada.other@atmosone.com");
assert.equal(ada.jobTitle, "CEO");
assert.equal(ada.notes, "Keep this note");
assert.equal(ada.contactType, "investor");
assert.equal(ada.linkedinUrl, "https://linkedin.com/in/ada");
assert.deepEqual(ada.tags, ["VIP", "warm"]);
assert.equal(ada.status, "active");
assert.equal(ada.companyId, "co-atmos");

const company = merged.companies.find((item) => item.id === "co-atmos");
assert.ok(company);
assert.equal(company.notes, "Charlotte's notes");
assert.equal(company.websiteUrl, "https://atmosone.com");
assert.equal(company.name, "AtmosOne");
assert.ok(merged.companies.some((item) => item.name === "NewCo"));

const grace = merged.people.find((person) => person.id === "p-grace");
assert.equal(grace?.jobTitle, "Advisor");

const sams = merged.people.filter((person) => person.name.toLowerCase() === "sam lee");
assert.equal(sams.length, 3);
assert.equal(sams.filter((person) => person.notes === "Ambiguous").length, 1);

const alice = merged.people.find((person) => person.id === "p-collide");
assert.equal(alice?.name, "Alice");
assert.equal(alice?.email, "alice@atmosone.com");
const bob = merged.people.find((person) => person.email === "bob@newco.com");
assert.ok(bob);
assert.notEqual(bob.id, "p-collide");

const oldEvent = merged.events.find((event) => event.id === "ev-ada-old");
assert.equal(oldEvent?.notes, "Charlotte's message");
assert.equal(oldEvent?.externalId, "outlook-1");
assert.equal(merged.events.filter((event) => event.externalId === "outlook-1").length, 1);

const reply = merged.events.find((event) => event.id === "ev-ada-new");
assert.equal(reply?.personId, "p-ada");
assert.equal(reply?.notes, "New reply");

const bea = merged.people.find((person) => person.email === "bea@newco.com");
assert.ok(bea?.companyId);
assert.equal(merged.companies.find((item) => item.id === bea.companyId)?.name, "NewCo");
const beaEvent = merged.events.find((event) => event.id === "ev-bea");
assert.equal(beaEvent?.personId, bea.id);
assert.equal(beaEvent?.type, "custom-whatsapp");

const bobEvent = merged.events.find((event) => event.id === "ev-bob");
assert.equal(bobEvent?.personId, bob.id);
assert.notEqual(bobEvent?.personId, "p-collide");

const investors = merged.mailingLists.find((list) => list.id === "list-investors");
assert.equal(investors?.name, "Investors");
assert.equal(investors?.contactType, "investor");
assert.deepEqual(investors?.tags, ["a", "b"]);
assert.deepEqual(investors?.subtags, ["seed", "angel"]);
assert.ok(merged.mailingLists.some((list) => list.name === "Newsletter"));

assert.equal(merged.customEventTypes.length, 1);
assert.equal(merged.customEventTypes[0].name, "WhatsApp");
assert.equal(
  merged.contactSubtags.customTypes.some((type) => type.id === "advisor"),
  true
);
assert.deepEqual(
  merged.contactSubtags.byType.investor?.map((tag) => tag.id).sort(),
  ["family-office", "growth"]
);
assert.deepEqual(merged.contactSubtags.byType.advisor, [{ id: "technical", label: "Technical" }]);

const fullSlots = mergeAtmosoneData(
  {
    people: [
      {
        id: "p-full",
        name: "Full Inbox",
        email: "a@x.com",
        secondaryEmail: "b@x.com",
        status: "active",
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    companies: [],
    events: [],
    mailingLists: [],
    customEventTypes: [],
  },
  {},
  parseAtmosoneData(
    JSON.stringify(
      buildAtmosoneData(
        {
          people: [
            {
              id: "in-full",
              name: "Full Inbox",
              email: "c@x.com",
              secondaryEmail: "a@x.com",
              status: "active",
              tags: [],
              createdAt: "2026-03-01T00:00:00.000Z",
              updatedAt: "2026-03-01T00:00:00.000Z",
            },
          ],
          companies: [],
          events: [],
          mailingLists: [],
          customEventTypes: [],
        },
        {}
      )
    )
  )
);
const fullPerson = fullSlots.people.find((person) => person.id === "p-full");
assert.equal(fullPerson?.email, "a@x.com");
assert.equal(fullPerson?.secondaryEmail, "b@x.com");
assert.equal(fullSlots.summary.people.added, 0);
assert.equal(fullSlots.summary.people.updated, 0);
assert.equal(fullSlots.people.length, 1);

assert.throws(() => parseAtmosoneData("{"), /valid JSON/);
assert.throws(() => parseAtmosoneData(JSON.stringify({ hello: "nope" })), /not an AtmosOne/);

const second = mergeAtmosoneData(merged, merged.contactSubtags, parsed);
assert.equal(second.summary.people.added, 0);
assert.equal(second.summary.people.updated, 0);
assert.equal(second.summary.companies.added, 0);
assert.equal(second.summary.events.added, 0);
assert.equal(second.summary.lists.added, 0);
assert.equal(second.summary.contactTypesAdded, 0);
assert.equal(second.summary.subtagsAdded, 0);
assert.equal(second.people.length, merged.people.length);

console.log("data merge fixture passed");
