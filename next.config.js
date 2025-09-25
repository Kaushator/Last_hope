/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    HTX_API_KEY: process.env.HTX_API_KEY || '',
    HTX_SECRET_KEY: process.env.HTX_SECRET_KEY || '',
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || '',
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}

module.exports = nextConfig