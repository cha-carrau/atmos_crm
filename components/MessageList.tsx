"use client";

import { useState } from "react";
import { Event, EventTypeCategory } from "@/types";
import { useStore } from "@/store/useStore";
import Badge from "./Badge";
import EditEventModal from "./EditEventModal";

interface MessageListProps {
  events: Event[];
}

export function isMessageCategory(category?: EventTypeCategory) {
  return category === "outbound-message" || category === "inbound-message";
}

function messageCopy(event: Event) {
  const storedSubject = (event as Event & { subject?: string }).subject?.trim();
  const notes = event.notes?.trim() || "";

  if (storedSubject && notes && notes !== storedSubject) {
    const detail = notes.startsWith(`${storedSubject}\n`)
      ? notes.slice(storedSubject.length + 1).trim()
      : notes.startsWith(storedSubject)
        ? notes.slice(storedSubject.length).trim()
        : notes;
    return { title: storedSubject, detail: detail || undefined, empty: false };
  }

  if (storedSubject) return { title: storedSubject, detail: undefined, empty: false };
  if (!notes) return { title: "No subject", detail: undefined, empty: true };

  const newline = notes.indexOf("\n");
  if (newline > 0) {
    const title = notes.slice(0, newline).trim();
    const detail = notes.slice(newline + 1).trim();
    return { title: title || "No subject", detail: detail || undefined, empty: !title };
  }

  return { title: notes, detail: undefined, empty: false };
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MessageList({ events }: MessageListProps) {
  const { deleteEvent, getEventTypeById } = useStore();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          No messages yet. Emails and other messages you send or receive will show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800">
        {events.map((event) => {
          const eventType = getEventTypeById(event.type);
          const inbound = eventType?.category === "inbound-message";
          const copy = messageCopy(event);
          const fromOutlook = event.externalId?.startsWith("outlook-");

          return (
            <div key={event.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
                      inbound
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900"
                        : "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900"
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 ${
                        inbound
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={inbound ? "info" : "primary"}>
                        {inbound ? "Received" : "Sent"}
                      </Badge>
                      <Badge variant="soft">{eventType?.name || event.type}</Badge>
                      {fromOutlook && <Badge variant="soft">Outlook</Badge>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(event.date)}
                        {event.time && ` • ${event.time}`}
                      </div>
                      <button
                        onClick={() => setEditingEvent(event)}
                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                        title="Edit message"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeletingEventId(event.id)}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete message"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p
                    className={`text-sm mt-2 leading-relaxed break-words ${
                      copy.empty
                        ? "text-gray-400 dark:text-gray-500 italic"
                        : "font-medium text-gray-900 dark:text-white"
                    }`}
                  >
                    {copy.title}
                  </p>
                  {copy.detail && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mt-1 whitespace-pre-wrap break-words">
                      {copy.detail}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editingEvent && (
        <EditEventModal
          isOpen={true}
          onClose={() => setEditingEvent(null)}
          event={editingEvent}
        />
      )}

      {deletingEventId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Delete message
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingEventId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteEvent(deletingEventId);
                  setDeletingEventId(null);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
