import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
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
            'linear-gradient(145deg, rgba(15,118,110,1) 0%, rgba(13,148,136,1) 45%, rgba(8,47,73,1) 100%)',
          color: 'white',
          fontSize: 64,
          fontWeight: 800,
          borderRadius: 36,
          letterSpacing: '-0.08em',
        }}
      >
        ZM
      </div>
    ),
    size
  );
}
