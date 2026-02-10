/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['genkit', '@genkit-ai/googleai', '@genkit-ai/firebase', 'require-in-the-middle'],
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'tse3.mm.bing.net',
      },
      {
        protocol: 'https',
        hostname: 'a-static.mlcdn.com.br',
      },
      {
        protocol: 'https',
        hostname: 'images.tcdn.com.br',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle these on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        performance: false,
        'require-in-the-middle': false,
        '@opentelemetry/exporter-jaeger': false,
        '@genkit-ai/firebase': false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
