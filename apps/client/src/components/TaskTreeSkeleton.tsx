interface TaskTreeSkeletonProps {
  count?: number;
}

export function TaskTreeSkeleton({ count = 3 }: TaskTreeSkeletonProps) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center px-0.5 py-1 text-sm rounded-md">
          {/* Chevron skeleton */}
          <div className="w-4 h-4 mr-1.5 flex items-center justify-center">
            <div className="w-3 h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
          
          {/* Status icon skeleton */}
          <div className="mr-2 flex-shrink-0">
            <div className="w-3 h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full animate-pulse" />
          </div>
          
          {/* Text skeleton */}
          <div className="flex-1 min-w-0">
            <div 
              className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse"
              style={{ width: `${60 + Math.random() * 40}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}