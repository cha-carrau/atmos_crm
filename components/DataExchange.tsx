"use client";

import { useRef, useState } from "react";
import { useStore } from "@/store/useStore";
import { useContactSubtags } from "@/store/useContactSubtags";
import {
  AtmosoneDataFile,
  MergeSummary,
  buildAtmosoneData,
  mergeAtmosoneData,
  mergeHasChanges,
  parseAtmosoneData,
} from "@/lib/dataExchange";

function fileDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function currentWorkspace() {
  const state = useStore.getState();
  const tags = useContactSubtags.getState();
  return {
    workspace: {
      people: state.people,
      companies: state.companies,
      events: state.events,
      mailingLists: state.mailingLists,
      customEventTypes: state.customEventTypes,
    },
    catalog: {
      byType: tags.byType,
      customTypes: tags.customTypes,
    },
  };
}

function SummaryList({ summary }: { summary: MergeSummary }) {
  const rows = [
    ["People", summary.people],
    ["Companies", summary.companies],
    ["Lists", summary.lists],
    ["Events", summary.events],
  ] as const;

  return (
    <ul className="mt-3 space-y-1 text-sm text-gray-900 dark:text-white">
      {rows.map(([label, counts]) => (
        <li key={label}>
          {label}: {counts.added} will be added, {counts.updated} will be updated
        </li>
      ))}
      {summary.contactTypesAdded > 0 && (
        <li>Contact types: {summary.contactTypesAdded} will be added</li>
      )}
      {summary.subtagsAdded > 0 && (
        <li>Sub-categories: {summary.subtagsAdded} will be added</li>
      )}
      {summary.eventTypesAdded > 0 && (
        <li>Event types: {summary.eventTypesAdded} will be added</li>
      )}
    </ul>
  );
}

export default function DataExchange() {
  const applyMergedData = useStore((state) => state.applyMergedData);
  const applyCatalog = useContactSubtags((state) => state.applyCatalog);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFile = useRef<AtmosoneDataFile | null>(null);
  const [summary, setSummary] = useState<MergeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const download = () => {
    const { workspace, catalog } = currentWorkspace();
    downloadJson(`atmosone-data-${fileDate()}.json`, buildAtmosoneData(workspace, catalog));
  };

  const chooseFile = () => {
    setError(null);
    setSuccess(null);
    fileInputRef.current?.click();
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setSuccess(null);
    setSummary(null);
    pendingFile.current = null;

    try {
      const text = await file.text();
      const parsed = parseAtmosoneData(text);
      const { workspace, catalog } = currentWorkspace();
      const result = mergeAtmosoneData(workspace, catalog, parsed);
      pendingFile.current = parsed;
      setSummary(result.summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that file.");
    }
  };

  const cancel = () => {
    pendingFile.current = null;
    setSummary(null);
  };

  const confirm = () => {
    const file = pendingFile.current;
    if (!file || !summary) return;
    const { workspace, catalog } = currentWorkspace();
    const result = mergeAtmosoneData(workspace, catalog, file);
    if (!mergeHasChanges(result.summary)) {
      pendingFile.current = null;
      setSummary(null);
      setSuccess("Nothing new to add. This workspace was left as it is.");
      return;
    }

    const workspaceChanged =
      result.summary.people.added +
        result.summary.people.updated +
        result.summary.companies.added +
        result.summary.companies.updated +
        result.summary.lists.added +
        result.summary.lists.updated +
        result.summary.events.added +
        result.summary.eventTypesAdded >
      0;
    if (workspaceChanged) {
      applyMergedData({
        people: result.people,
        companies: result.companies,
        events: result.events,
        mailingLists: result.mailingLists,
        customEventTypes: result.customEventTypes,
      });
    }
    if (result.summary.contactTypesAdded > 0 || result.summary.subtagsAdded > 0) {
      applyCatalog(result.contactSubtags);
    }

    const { people, companies, lists, events } = result.summary;
    pendingFile.current = null;
    setSummary(null);
    setSuccess(
      `Workspace updated. People: ${people.added} added, ${people.updated} updated. Companies: ${companies.added} added, ${companies.updated} updated. Lists: ${lists.added} added, ${lists.updated} updated. Events: ${events.added} added.`
    );
  };

  return (
    <section className="mb-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Share a copy of your data</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-3xl">
        Download all data saves one JSON file of contacts, companies, lists, messages, and custom
        contact types. On another copy of this app, choose Upload data to update and confirm. Upload
        adds what is missing and fills empty fields. It does not delete records already in this
        workspace.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download all data
        </button>
        <button
          type="button"
          onClick={chooseFile}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload data to update
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Could not read that file</h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">{success}</p>
        </div>
      )}

      {summary && (
        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-4">
          {mergeHasChanges(summary) ? (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                This merges into the current workspace. Records already here stay, including ones that
                are not in the file.
              </p>
              <SummaryList summary={summary} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirm}
                  className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Confirm update
                </button>
                <button
                  type="button"
                  onClick={cancel}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Nothing new to add or update. This workspace was not changed.
              </p>
              <button
                type="button"
                onClick={cancel}
                className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium rounded-lg"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
