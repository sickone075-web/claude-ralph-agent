import { cn } from "@/lib/utils"

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "skeleton rounded-lg h-32",
        className
      )}
    />
  )
}
