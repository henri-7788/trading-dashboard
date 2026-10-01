/** Shimmering placeholder bar; size and shape come from the caller's classes. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />
}

/** Placeholder rows for a glass table while its data is still loading. */
export function SkeletonTableRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-b border-white/[0.06] last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <td key={c} className="py-3.5 px-4">
              {c === 0 ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 shrink-0" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : (
                <Skeleton className={`h-3 ${c % 3 === 0 ? 'w-10' : c % 2 === 0 ? 'w-20' : 'w-14'}`} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
