import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'SecondBrain — AI Personal Dashboard',
    short_name: 'SecondBrain',
    description:
      'Dashboard pribadi berbasis AI untuk tugas, catatan, agenda, blog, dan workflow harian.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f7fb',
    theme_color: '#0f766e',
    lang: 'id-ID',
    categories: ['productivity', 'business', 'education'],
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/',
        description: 'Buka ringkasan dashboard utama',
      },
      {
        name: 'Tugas',
        short_name: 'Tugas',
        url: '/tasks',
        description: 'Lihat dan kelola daftar tugas',
      },
      {
        name: 'Catatan',
        short_name: 'Catatan',
        url: '/notes',
        description: 'Buka catatan cepat dan ide',
      },
    ],
  };
}
