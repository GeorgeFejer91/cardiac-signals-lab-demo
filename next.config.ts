import type { NextConfig } from 'next';

const pagesBasePath = process.env.PAGES_BASE_PATH ?? '';
const isStaticExport = process.env.STATIC_EXPORT === '1';

const nextConfig: NextConfig = isStaticExport
  ? {
      output: 'export',
      trailingSlash: true,
      basePath: pagesBasePath,
      assetPrefix: pagesBasePath || undefined,
      images: {
        unoptimized: true,
      },
    }
  : {};

export default nextConfig;
