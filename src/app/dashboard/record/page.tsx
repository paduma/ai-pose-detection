'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import VideoRecorder from '@/components/VideoRecorder';
import RealtimePoseAnalyzer from '@/components/RealtimePoseAnalyzer';
import { ExerciseType } from '@/lib/mediapipe';

type Mode = 'select' | 'realtime' | 'record';

export default function RecordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useAuthStore();
  const [mode, setMode] = useState<Mode>('select');
  const [exerciseType, setExerciseType] = useState<ExerciseType>('squat');
  const [sessionResult, setSessionResult] = useState<any>(null);

  // 支持从 URL 参数直接进入实时模式：/dashboard/record?mode=realtime
  useEffect(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'realtime' || urlMode === 'record') {
      setMode(urlMode);
    }
  }, [searchParams]);

  const exerciseTypes = [
    { value: 'squat' as ExerciseType, label: '深蹲', icon: '🏋️', color: 'from-blue-500 to-blue-600' },
    { value: 'pushup' as ExerciseType, label: '俯卧撑', icon: '💪', color: 'from-purple-500 to-purple-600' },
    { value: 'plank' as ExerciseType, label: '平板支撑', icon: '🧘', color: 'from-green-500 to-green-600' },
    { value: 'lunge' as ExerciseType, label: '弓步蹲', icon: '🦵', color: 'from-orange-500 to-orange-600' },
  ];

  const handleSessionComplete = (summary: any) => {
    setSessionResult(summary);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="animate-slide-up">
        <div className="flex items-center space-x-4 mb-2">
          <button
            onClick={() => mode === 'select' ? router.push('/dashboard') : setMode('select')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white hover:bg-neutral-50 transition-colors shadow-soft"
          >
            <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 className="text-4xl font-bold text-neutral-900">
              {mode === 'realtime' ? '实时姿态分析' : mode === 'record' ? '录制视频' : '选择模式'}
            </h2>
            <p className="text-lg text-neutral-600 mt-1">
              {mode === 'realtime' ? '摄像头实时检测，即时反馈' : mode === 'record' ? '录制后上传分析' : '选择分析方式'}
            </p>
          </div>
        </div>
      </div>

      {mode === 'select' && (
        <div className="space-y-6">
          {/* 运动类型选择 */}
          <div className="card-modern p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">选择运动类型</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {exerciseTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setExerciseType(type.value)}
                  className={`p-5 rounded-2xl border-2 transition-all duration-300 hover-lift ${exerciseType === type.value
                    ? 'border-primary-500 bg-primary-50 shadow-soft'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                >
                  <div className="text-4xl mb-2">{type.icon}</div>
                  <div className="font-semibold text-neutral-900">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 模式选择 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            {/* 实时分析 */}
            <button
              onClick={() => setMode('realtime')}
              className="card-modern p-8 text-left hover-lift hover-glow group"
            >
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow flex-shrink-0">
                  <span className="text-3xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">实时分析</h3>
                  <p className="text-neutral-600 mb-3">
                    打开摄像头，AI 实时检测姿态并在画面上叠加骨骼线条和评分，即时反馈动作问题。
                  </p>
                  <div className="flex items-center space-x-2 text-green-600 font-medium">
                    <span>推荐</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>

            {/* 录制模式 */}
            <button
              onClick={() => setMode('record')}
              className="card-modern p-8 text-left hover-lift hover-glow group"
            >
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow flex-shrink-0">
                  <span className="text-3xl">🎥</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">录制视频</h3>
                  <p className="text-neutral-600 mb-3">
                    先录制运动视频，录制完成后可以下载保存或上传进行离线分析。
                  </p>
                  <div className="flex items-center space-x-2 text-neutral-500 font-medium">
                    <span>传统模式</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {mode === 'realtime' && (
        <div className="space-y-6">
          <RealtimePoseAnalyzer
            exerciseType={exerciseType}
            onSessionComplete={handleSessionComplete}
          />

          {/* 会话结果 */}
          {sessionResult && (
            <div className="card-modern p-6 animate-slide-up">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">训练总结</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-neutral-50 rounded-xl">
                  <div className="text-3xl font-bold text-primary-600">{sessionResult.avgScore}</div>
                  <div className="text-sm text-neutral-500 mt-1">平均评分</div>
                </div>
                <div className="text-center p-4 bg-neutral-50 rounded-xl">
                  <div className="text-3xl font-bold text-secondary-600">{sessionResult.totalFrames}</div>
                  <div className="text-sm text-neutral-500 mt-1">分析帧数</div>
                </div>
                <div className="text-center p-4 bg-neutral-50 rounded-xl">
                  <div className="text-3xl font-bold text-orange-600">
                    {Math.floor(sessionResult.duration / 60)}:{(sessionResult.duration % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-sm text-neutral-500 mt-1">训练时长</div>
                </div>
              </div>
              {sessionResult.issues.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-2">检测到的问题</h4>
                  <ul className="space-y-1">
                    {sessionResult.issues.map((issue: string, idx: number) => (
                      <li key={idx} className="text-sm text-yellow-700">• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'record' && (
        <div className="card-modern p-6">
          <VideoRecorder
            onRecordingComplete={(blob, url) => {
              console.log('录制完成:', (blob.size / 1024 / 1024).toFixed(2), 'MB');
            }}
            maxDuration={120}
          />
        </div>
      )}
    </div>
  );
}
