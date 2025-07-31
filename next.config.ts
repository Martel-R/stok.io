
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  dynamicParams: false, // Adicionado para lidar com rotas dinâmicas na exportação estática
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
