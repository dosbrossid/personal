import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig['images']>['remotePatterns'] = [
  {
    protocol: 'https',
    hostname: '**.supabase.co',
    port: '',
    pathname: '/storage/v1/object/public/**',
    search: '',
  },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (supabaseUrl) {
  try {
    const parsedUrl = new URL(supabaseUrl);
    remotePatterns.unshift({
      protocol: parsedUrl.protocol.replace(':', '') as 'http' | 'https',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      pathname: '/storage/v1/object/public/**',
      search: '',
    });
  } catch {
    // Ignore invalid env formats and keep the generic Supabase fallback pattern.
  }
}

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    remotePatterns,
  },
};

export default nextConfig;
