import { AzkarCardSkeleton, Skeleton } from '@/components/ui/Skeleton';

/** Скелетон раздела: та же геометрия, что и у реальных карточек — без скачка вёрстки. */
export default function CategoryLoading() {
  return (
    <div>
      <div className="border-b border-line">
        <div className="container-az py-3">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-14" />
          </div>
          <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
        </div>
      </div>

      <div className="container-az flex flex-col gap-4 pt-4 safe-bottom">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <AzkarCardSkeleton />
        <AzkarCardSkeleton />
      </div>
    </div>
  );
}
