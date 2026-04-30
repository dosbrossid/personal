import { ImageResponse } from 'next/og';
import { createServerClient } from '@/lib/supabase/server';

export const alt = 'Ziaul Maula Blog';
export const contentType = 'image/png';
export const size = {
  width: 1200,
  height: 630,
};

type Props = {
  params: Promise<{ slug: string }>;
};

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const supabase = await createServerClient();
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, featured_image_url')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (!post) {
    return new Response('Not found', { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: '#f8f6ef',
          color: '#242424',
          fontFamily: 'Georgia, Cambria, Times New Roman, serif',
        }}
      >
        {post.featured_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.featured_image_url}
            alt=""
            width="1200"
            height="630"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(248,246,239,0.96) 0%, rgba(248,246,239,0.88) 44%, rgba(248,246,239,0.2) 100%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '72px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: '-0.04em',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: '#242424',
                  color: '#ffffff',
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                ZM
              </div>
              <span>Ziaul Maula</span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 72,
                lineHeight: 0.98,
                letterSpacing: '-0.055em',
                fontWeight: 700,
              }}
            >
              {truncateText(post.title, 88)}
            </h1>
            {post.excerpt ? (
              <p
                style={{
                  margin: 0,
                  maxWidth: 660,
                  color: '#5f5f5f',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: 30,
                  lineHeight: 1.25,
                }}
              >
                {truncateText(post.excerpt, 132)}
              </p>
            ) : null}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#1a8917',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            zmaula.web.id
          </div>
        </div>
      </div>
    ),
    size
  );
}
