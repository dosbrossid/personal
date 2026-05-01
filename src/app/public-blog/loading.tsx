export default function PublicBlogLoading() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-1 py-8" aria-label="Memuat halaman blog">
      <div className="mb-10 h-4 w-40 animate-pulse rounded-full bg-[#eee9df] dark:bg-white/10" />
      <div className="space-y-4">
        <div className="h-10 w-11/12 animate-pulse rounded-xl bg-[#eee9df] dark:bg-white/10" />
        <div className="h-10 w-8/12 animate-pulse rounded-xl bg-[#eee9df] dark:bg-white/10" />
        <div className="mt-6 h-5 w-full animate-pulse rounded-full bg-[#f4efe6] dark:bg-white/[0.07]" />
        <div className="h-5 w-10/12 animate-pulse rounded-full bg-[#f4efe6] dark:bg-white/[0.07]" />
      </div>
      <div className="mt-10 aspect-[16/9] w-full animate-pulse rounded-3xl bg-[#eee9df] dark:bg-white/10" />
      <div className="mt-10 space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-5 animate-pulse rounded-full bg-[#f4efe6] dark:bg-white/[0.07]"
            style={{ width: `${index % 3 === 0 ? 96 : index % 3 === 1 ? 88 : 72}%` }}
          />
        ))}
      </div>
    </div>
  );
}
