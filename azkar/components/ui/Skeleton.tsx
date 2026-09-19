import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-xl', className)} />;
}

/** Заглушка карточки азкара на время загрузки раздела. */
export function AzkarCardSkeleton() {
  return (
    <div className="rounded-card-lg border border-line bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <Skeleton className="mt-6 h-10 w-full" />
      <Skeleton className="mt-3 h-10 w-4/5 ml-auto" />
      <Skeleton className="mt-7 h-5 w-full" />
      <Skeleton className="mt-2 h-5 w-11/12" />
      <Skeleton className="mt-6 h-16 w-full rounded-2xl" />
    </div>
  );
}

export function CategoryCardSkeleton() {
  return <Skeleton className="h-28 w-full rounded-card-lg" />;
}
