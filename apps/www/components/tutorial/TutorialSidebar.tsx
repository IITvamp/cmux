"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type TutorialSection = {
  title: string;
  slug: string;
  subsections?: {
    title: string;
    slug: string;
  }[];
};

type TutorialSidebarProps = {
  sections: TutorialSection[];
};

export function TutorialSidebar({ sections }: TutorialSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map((s) => s.slug))
  );

  const toggleSection = (slug: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const isActive = (slug: string) => pathname === `/tutorial/${slug}`;

  return (
    <nav className="h-full overflow-y-auto border-r border-neutral-800 bg-neutral-950/50">
      <div className="px-4 py-6">
        <div className="mb-6">
          <Link
            href="/tutorial"
            className="text-xl font-semibold text-white hover:text-blue-400 transition-colors"
          >
            Documentation
          </Link>
        </div>

        <div className="space-y-1">
          {sections.map((section) => {
            const hasSubsections = section.subsections && section.subsections.length > 0;
            const isExpanded = expandedSections.has(section.slug);

            return (
              <div key={section.slug} className="space-y-1">
                {hasSubsections ? (
                  <>
                    <button
                      onClick={() => toggleSection(section.slug)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors"
                    >
                      <span>{section.title}</span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-neutral-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-neutral-500" />
                      )}
                    </button>
                    {isExpanded && section.subsections && (
                      <div className="ml-3 space-y-1 border-l border-neutral-800 pl-3">
                        {section.subsections.map((subsection) => (
                          <Link
                            key={subsection.slug}
                            href={`/tutorial/${subsection.slug}`}
                            className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                              isActive(subsection.slug)
                                ? "bg-blue-500/10 text-blue-400 font-medium"
                                : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                            }`}
                          >
                            {subsection.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={`/tutorial/${section.slug}`}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive(section.slug)
                        ? "bg-blue-500/10 text-blue-400"
                        : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                    }`}
                  >
                    {section.title}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
