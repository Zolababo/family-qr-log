import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const base = [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // camera=(self): 글쓰기 화면 input capture="environment"와 호환 (camera=()는 일부 브라우저에서 차단)
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(), geolocation=()',
      },
    ] as { key: string; value: string }[];
    if (isProd) {
      base.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      });
    }
    return [
      {
        source: '/:path*',
        headers: base,
      },
    ];
  },
};

export default nextConfig;
