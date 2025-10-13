"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

type SidebarSection = {
  id: string;
  title: string;
};

type TutorialSidebarProps = {
  sections: SidebarSection[];
};

export function TutorialSidebar({ sections }: TutorialSidebarProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) {
          return;
        }

        const sorted = visibleEntries.sort(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        );
        const firstVisible = sorted[0];

        if (firstVisible?.target?.id) {
          setActiveId(firstVisible.target.id);
        }
      },
      {
        rootMargin: "-40% 0px -45% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [sections]);

  if (sections.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Tutorial sections" className="hidden lg:block">
      <div className="sticky top-24 flex flex-col gap-4 text-sm text-neutral-400">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          Guide
        </p>
        <ul className="space-y-1">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={clsx(
                    "group relative block rounded-md px-3 py-2 transition-colors",
                    isActive
                      ? "bg-neutral-900/80 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.4)]"
                      : "hover:bg-neutral-900/60 hover:text-white",
                  )}
                >
                  <span className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 group-hover:text-neutral-300">
                    Section
                  </span>
                  <span className="text-sm font-medium">{section.title}</span>
                  {isActive ? (
                    <span
                      className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-blue-500"
                      aria-hidden
                    ></span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
