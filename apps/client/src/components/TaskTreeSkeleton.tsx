interface TaskTreeSkeletonProps {
  count?: number;
}

export function TaskTreeSkeleton({ count = 5 }: TaskTreeSkeletonProps) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <TaskItemSkeleton key={i} />
      ))}
    </div>
  );
}

function TaskItemSkeleton() {
  return (
    <div className="flex items-center px-0.5 py-1 text-sm rounded-md">
      <div className="w-4 h-4 mr-1.5 rounded animate-pulse bg-neutral-200 dark:bg-neutral-700 invisible" />
      <div className="w-3 h-3 mr-2 rounded-full animate-pulse bg-neutral-200 dark:bg-neutral-700" />
      <div className="flex-1">
        <div
          className="h-3 rounded animate-pulse bg-neutral-200 dark:bg-neutral-700"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      </div>
    </div>
  );
}
