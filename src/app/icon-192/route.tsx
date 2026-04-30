import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top left, rgba(45,212,191,0.95), rgba(15,118,110,1) 48%, rgba(15,23,42,1) 100%)',
          color: 'white',
          fontSize: 70,
          fontWeight: 800,
          letterSpacing: '-0.08em',
        }}
      >
        ZM
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  );
}
