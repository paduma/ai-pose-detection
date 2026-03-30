/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // 支持 MediaPipe 和 FFmpeg 的 WASM 文件
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    
    // 支持 WASM
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // @ffmpeg/ffmpeg 的 worker.js 内部用 import(coreURL) 动态加载 core，
    // webpack 会把 import() 替换成 __webpack_require__，导致 blob/http URL 加载失败。
    // 解决方案：对 @ffmpeg 包禁用 webpack 的 JS parser，让代码原样输出。
    if (!isServer) {
      config.module.rules.push({
        test: /[\\/]@ffmpeg[\\/]ffmpeg[\\/]dist[\\/]/,
        type: 'javascript/auto',
        parser: {
          // 不解析 import/export，保留原始代码
          import: false,
          dynamicImport: false,
        },
      });
    }
    
    return config;
  },
  
  // 图片优化配置
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // FFmpeg.wasm 需要 SharedArrayBuffer，浏览器要求这两个头
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },

  // 环境变量（服务端变量通过 process.env 自动可用，无需在此声明）
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
