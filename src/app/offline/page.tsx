import Link from 'next/link';
import { WifiOff } from 'lucide-react';

export const metadata = {
  title: 'Offline | Zmaula Dashboard',
  description: 'Halaman fallback saat koneksi internet tidak tersedia.',
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-teal-100 text-teal-700 shadow-sm">
          <WifiOff className="h-8 w-8" />
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">
          Mode offline
        </p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Koneksi lagi putus sebentar.
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
          Dashboard butuh koneksi untuk membaca data terbaru dari database. Coba lagi saat internet
          sudah stabil, atau buka halaman blog yang pernah kamu kunjungi sebelumnya.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-2xl bg-teal-700 px-5 text-sm font-bold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-800"
          >
            Coba ke dashboard
          </Link>
          <Link
            href="/public-blog"
            className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-200 hover:text-teal-700"
          >
            Buka blog
          </Link>
        </div>
      </section>
    </main>
  );
}
