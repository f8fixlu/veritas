"use client";

import { useState, type ReactNode } from "react";

export type ResultTab = {
  id: string;
  label: string;
  count: number;
  content: ReactNode;
};

export default function ResultTabs({ tabs }: { tabs: ResultTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Result type"
        className="flex items-center gap-6 border-b border-slate-200"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`results-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`results-panel-${tab.id}`}
              onClick={() => setActive(tab.id)}
              className={`-mb-px flex items-baseline gap-2 border-b-2 pb-3 pt-1 text-lg font-semibold tracking-tight transition-colors ${
                selected
                  ? "border-indigo-600 text-slate-900"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
              <span className="text-sm font-normal text-slate-500">
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`results-panel-${tab.id}`}
          aria-labelledby={`results-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="mt-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
