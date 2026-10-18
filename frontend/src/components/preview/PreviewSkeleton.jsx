export default function PreviewSkeleton() {
  return (
    <div className="px-4 py-6 md:py-8 animate-pulse">
      <div className="flex gap-8 justify-center max-w-[88rem] mx-auto">
        <div className="w-full max-w-3xl min-w-0">
          <div className="flex items-center justify-between mb-5">
            <div className="h-4 w-20 rounded-full bg-black/[0.06] dark:bg-white/[0.07]" />
            <div className="flex gap-2">
              <div className="h-8 w-20 rounded-md bg-black/[0.05] dark:bg-white/[0.06]" />
              <div className="h-8 w-24 rounded-md bg-black/[0.05] dark:bg-white/[0.06]" />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="h-5 w-16 rounded-full bg-accent/20" />
            <div className="h-3.5 w-12 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
            <div className="ml-auto h-3.5 w-28 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
          </div>
          <div className="rounded-2xl border border-black/[0.07] dark:border-white/[0.07] bg-white/60 dark:bg-white/[0.03] p-6 md:p-8 space-y-5">
            <div className="h-6 w-3/4 rounded-full bg-black/[0.08] dark:bg-white/[0.10]" />
            <div className="space-y-3">
              <div className="h-4 w-2/5 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="space-y-2">
                {[100,92,97,85,100,60].map((w,i) => <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{width:`${w}%`}} />)}
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 w-1/3 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="space-y-2">
                {[95,100,88,72].map((w,i) => <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{width:`${w}%`}} />)}
              </div>
            </div>
            <div className="space-y-3 opacity-40">
              <div className="h-4 w-2/5 rounded-full bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="space-y-2">
                {[100,90,78,65].map((w,i) => <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{width:`${w}%`}} />)}
              </div>
            </div>
          </div>
        </div>
        <div className="hidden xl:block w-52 shrink-0 space-y-2 pt-16">
          {[60,45,55,40,50].map((w,i) => <div key={i} className="h-3 rounded-full bg-black/[0.05] dark:bg-white/[0.06]" style={{width:`${w}%`, opacity: 1 - i*0.15}} />)}
        </div>
      </div>
    </div>
  );
}
