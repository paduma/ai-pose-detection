'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import axios from 'axios';

interface Analysis {
  _id: string;
  exerciseType: string;
  status: string;
  results?: {
    score: number;
    totalFrames: number;
    detectedFrames: number;
    recommendations: string[];
    metrics: {
      angleAccuracy: number;
      positionStability: number;
      movementSmooth: number;
    };
  };
  createdAt: string;
}

export default function AnalysisPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await axios.get(`/api/pose/${params.id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setAnalysis(response.data.analysis);
      } catch (err: any) {
        setError(err.response?.data?.error || '获取分析结果失败');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();

    // Poll for updates if still processing
    const interval = setInterval(() => {
      if (analysis?.status === 'processing') {
        fetchAnalysis();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [params.id, token, analysis?.status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error || '分析不存在'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          返回首页
        </button>
      </div>
    );
  }

  if (analysis.status === 'processing') {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">正在分析中...</h2>
          <p className="mt-2 text-gray-600">这可能需要几分钟时间，请稍候</p>
        </div>
      </div>
    );
  }

  const exerciseNames: Record<string, string> = {
    squat: '深蹲',
    pushup: '俯卧撑',
    plank: '平板支撑',
    lunge: '弓步蹲',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">分析结果</h2>
          <p className="mt-2 text-gray-600">
            {exerciseNames[analysis.exerciseType]} - {new Date(analysis.createdAt).toLocaleString('zh-CN')}
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard/history')}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
        >
          查看历史
        </button>
      </div>

      {/* Score Card */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 text-white">
        <div className="text-center">
          <p className="text-lg font-medium opacity-90">综合得分</p>
          <p className="text-6xl font-bold mt-2">{analysis.results?.score}</p>
          <p className="text-lg mt-2 opacity-90">/ 100</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">角度准确度</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analysis.results?.metrics.angleAccuracy}%
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">位置稳定性</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analysis.results?.metrics.positionStability}%
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">动作流畅度</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analysis.results?.metrics.movementSmooth}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Stats */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">检测统计</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">总帧数</p>
            <p className="text-2xl font-bold text-gray-900">{analysis.results?.totalFrames}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">检测到的帧数</p>
            <p className="text-2xl font-bold text-gray-900">{analysis.results?.detectedFrames}</p>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">改进建议</h3>
        <ul className="space-y-3">
          {analysis.results?.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start space-x-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </span>
              <span className="text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex space-x-4">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          上传新视频
        </button>
        <button
          onClick={() => router.push('/dashboard/history')}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
        >
          查看历史记录
        </button>
      </div>
    </div>
  );
}
