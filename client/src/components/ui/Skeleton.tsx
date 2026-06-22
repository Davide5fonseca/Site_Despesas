import { CSSProperties } from "react";

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton rounded-xl ${className}`} style={style} />;
}

// Esqueleto de uma lista de movimentos (enquanto carrega)
export function SkeletonLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="space-y-4">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="overflow-hidden rounded-xl2 border border-linha/5 bg-noite-800/50">
            {Array.from({ length: linhas }).map((_, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-3 ${i > 0 ? "border-t border-linha/5" : ""}`}>
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
