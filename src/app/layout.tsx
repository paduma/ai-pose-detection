import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Pose Detection - 智能姿态分析系统',
  description: '基于 AI 的姿态检测和分析系统，帮助改善体态和运动姿势',
  keywords: ['AI', '姿态检测', 'Pose Detection', 'MediaPipe', 'Next.js'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
