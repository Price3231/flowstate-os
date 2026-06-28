import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Don't statically generate pages that depend on Supabase at build time
  output: 'standalone',
  experimental: {
    // Suppress missing env var errors during build
  },
}

export default nextConfig
