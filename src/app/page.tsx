import Link from 'next/link';
import { ArrowRight, Video, BarChart3, History } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="gradient-bg text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 animate-fade-in">
              AI 姿态检测系统
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-100 animate-slide-up">
              基于先进的 AI 技术，实时分析和改善你的体态
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
              <Link
                href="/register"
                className="bg-white text-purple-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
              >
                开始体验
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition-colors"
              >
                立即登录
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">核心功能</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Video className="w-12 h-12 text-purple-600" />}
              title="视频上传分析"
              description="上传视频，AI 自动分析每一帧的姿态数据"
            />
            <FeatureCard
              icon={<BarChart3 className="w-12 h-12 text-purple-600" />}
              title="实时姿态检测"
              description="使用摄像头实时检测和分析你的姿态"
            />
            <FeatureCard
              icon={<History className="w-12 h-12 text-purple-600" />}
              title="历史记录追踪"
              description="查看历史分析记录，追踪改善进度"
            />
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">技术栈</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <TechCard name="Next.js 14" description="React 框架" />
            <TechCard name="TypeScript" description="类型安全" />
            <TechCard name="MediaPipe" description="AI 姿态检测" />
            <TechCard name="MongoDB" description="数据存储" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">准备好改善你的姿态了吗？</h2>
          <p className="text-xl mb-8 text-gray-100">
            立即注册，开始你的姿态改善之旅
          </p>
          <Link
            href="/register"
            className="bg-white text-purple-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
          >
            免费注册
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-lg card-hover">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function TechCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md text-center card-hover">
      <h4 className="font-bold text-lg mb-1">{name}</h4>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
