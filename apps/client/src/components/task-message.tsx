import { formatDistanceToNow } from "date-fns";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  authorName: string;
  content: string;
  timestamp?: number;
  avatar?: ReactNode; // If provided, rendered instead of image url
  authorImageUrl?: string;
  authorAlt?: string;
};

export function TaskMessage({
  authorName,
  content,
  timestamp,
  avatar,
  authorImageUrl,
  authorAlt,
}: Props) {
  return (
    <div className="mb-6">
      <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2 mb-2">
          {avatar ? (
            <div className="size-5 flex-shrink-0 flex items-center justify-center">
              {avatar}
            </div>
          ) : (
            <img
              src={authorImageUrl || ""}
              alt={authorAlt || authorName}
              className="size-5 rounded-full flex-shrink-0"
            />
          )}
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100">
              {authorName}
            </span>
            {timestamp ? (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {formatDistanceToNow(timestamp, { addSuffix: true })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-[15px] font-medium text-neutral-700 dark:text-neutral-300 
          prose prose-neutral dark:prose-invert prose-sm max-w-none
          prose-p:my-1.5 prose-p:leading-relaxed
          prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
          prose-h1:text-xl prose-h1:mt-5 prose-h1:mb-3
          prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2.5
          prose-h3:text-base prose-h3:mt-3.5 prose-h3:mb-2
          prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
          prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
          prose-li:my-0.5
          prose-blockquote:border-l-4 prose-blockquote:border-neutral-300 dark:prose-blockquote:border-neutral-600
          prose-blockquote:pl-4 prose-blockquote:py-0.5 prose-blockquote:my-2
          prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700
          prose-code:text-[13px] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-neutral-900 dark:prose-pre:bg-neutral-800 prose-pre:text-neutral-100
          prose-pre:p-3 prose-pre:rounded-md prose-pre:my-2 prose-pre:overflow-x-auto
          prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:underline prose-a:break-words
          prose-table:my-2 prose-table:border prose-table:border-neutral-300 dark:prose-table:border-neutral-600
          prose-th:p-2 prose-th:bg-neutral-100 dark:prose-th:bg-neutral-800
          prose-td:p-2 prose-td:border prose-td:border-neutral-300 dark:prose-td:border-neutral-600
          prose-hr:my-3 prose-hr:border-neutral-300 dark:prose-hr:border-neutral-600
          prose-strong:font-semibold prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

