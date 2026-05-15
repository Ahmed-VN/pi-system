import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.16.36.49', 'localhost', '127.0.0.1'],
  experimental: {
    workerThreads: false,
  },
}

export default nextConfig