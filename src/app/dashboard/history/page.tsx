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
  };
  createdAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const url = filter === 'all'
          ? '/api/pose/history'
          : `/api/pose/history?exerciseType=${filter}`;

        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setAnalyses(response.data.analyses);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [token, filter]);

  const exerciseTypes = [
    { value: 'all', label: '全部' },
    { value: 'squat', label: '深蹲' },
    { value: 'pushup', label: '俯卧撑' },
    { value: 'plank', label: '平板支撑' },
    { value: 'lunge', label: '弓步蹲' },
  ];

  const exerciseNames: Record<string, string> = {
    squat: '深蹲',
    pushup: '俯卧撑',
    plank: '平板支撑',
    lunge: '弓步蹲',
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 70) return 'text-blue-600 bg-blue-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">历史记录</h2>
          <p className="mt-2 text-gray-600">查看您的所有分析记录</p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
        >
          上传新视频
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {exerciseTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setFilter(type.value)}
              className={`px-4 py-2 rounded-lg font-medium transition ${filter === type.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis List */}
      {analyses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-gray-600">暂无分析记录</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            开始第一次分析
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {analyses.map((analysis) => (
            <div
              key={analysis._id}
              onClick={() => router.push(`/dashboard/analysis/${analysis._id}`)}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  {exerciseNames[analysis.exerciseType]}
                </span>
                {analysis.status === 'completed' && analysis.results && (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(
                      analysis.results.score
                    )}`}
                  >
                    {analysis.results.score}分
                  </span>
                )}
                {analysis.status === 'processing' && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                    处理中
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600">
                {new Date(analysis.createdAt).toLocaleString('zh-CN')}
              </p>

              <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                查看详情
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
