import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Zmaula Personal Dashboard',
    short_name: 'Zmaula',
    description:
      'Dashboard pribadi berbasis AI untuk tugas, catatan, agenda, blog, vault, dan workflow harian.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait',
    background_color: '#f5f7fb',
    theme_color: '#0f766e',
    lang: 'id-ID',
    dir: 'ltr',
    prefer_related_applications: false,
    categories: ['productivity', 'business', 'education'],
    icons: [
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
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
        name: 'Agenda',
        short_name: 'Agenda',
        url: '/calendar',
        description: 'Buka kalender dan agenda',
      },
      {
        name: 'Catatan',
        short_name: 'Catatan',
        url: '/notes',
        description: 'Buka catatan cepat dan ide',
      },
      {
        name: 'Blog',
        short_name: 'Blog',
        url: '/blog',
        description: 'Kelola tulisan dan draft blog',
      },
    ],
  };
}
