'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useUploadStore } from '@/store/uploadStore';
import VideoAnalyzer from '@/components/VideoAnalyzer';
import axios from 'axios';

export default function DashboardPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const { setUploadProgress, setAnalysisId } = useUploadStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exerciseType, setExerciseType] = useState('squat');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

  const exerciseTypes = [
    { value: 'squat', label: '深蹲', icon: '🏋️', color: 'from-blue-500 to-blue-600' },
    { value: 'pushup', label: '俯卧撑', icon: '💪', color: 'from-purple-500 to-purple-600' },
    { value: 'plank', label: '平板支撑', icon: '🧘', color: 'from-green-500 to-green-600' },
    { value: 'lunge', label: '弓步蹲', icon: '🦵', color: 'from-orange-500 to-orange-600' },
  ];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        setSelectedFile(file);
      } else {
        alert('请上传视频文件');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('请选择视频文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('exerciseType', exerciseType);

      const response = await axios.post('/api/pose/analyze', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      setCurrentAnalysisId(response.data.analysisId);
      setAnalyzing(true);
    } catch (error: any) {
      alert(error.response?.data?.error || '上传失败，请稍后重试');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAnalysisComplete = async (results: any) => {
    if (!currentAnalysisId) return;

    try {
      await axios.put(
        '/api/pose/update',
        {
          analysisId: currentAnalysisId,
          results,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setAnalysisId(currentAnalysisId);
      router.push(`/dashboard/analysis/${currentAnalysisId}`);
    } catch (error: any) {
      alert(error.response?.data?.error || '保存分析结果失败');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {analyzing && selectedFile && currentAnalysisId ? (
        <VideoAnalyzer
          videoFile={selectedFile}
          exerciseType={exerciseType}
          onAnalysisComplete={handleAnalysisComplete}
        />
      ) : (
        <>
          {/* Header */}
          <div className="animate-slide-up">
            <h2 className="text-4xl font-bold text-neutral-900 mb-2">上传视频</h2>
            <p className="text-lg text-neutral-600">上传您的运动视频，获取 AI 姿态分析</p>
          </div>

          {/* Upload Area */}
          <div className="card-modern p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${dragActive
                ? 'border-primary-500 bg-primary-50 scale-[1.02]'
                : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="space-y-6">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-glow">
                  <svg
                    className="w-10 h-10 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>

                {selectedFile ? (
                  <div className="animate-scale-in">
                    <p className="text-xl font-semibold text-neutral-900">{selectedFile.name}</p>
                    <p className="text-neutral-600 mt-2">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="mt-4 text-sm text-accent-600 hover:text-accent-700 font-medium transition-colors"
                    >
                      重新选择
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xl font-semibold text-neutral-900 mb-2">
                      拖拽视频文件到这里，或点击选择
                    </p>
                    <p className="text-neutral-600">支持 MP4, MOV, AVI, WebM 等格式</p>
                  </div>
                )}

                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="inline-block btn-gradient cursor-pointer"
                >
                  选择文件
                </label>
              </div>
            </div>

            {/* Exercise Type Selection */}
            <div className="mt-8">
              <label className="block text-sm font-semibold text-neutral-700 mb-4">
                选择运动类型
              </label>
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

            {/* Upload Button */}
            <div className="mt-8">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="btn-gradient w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    上传中...
                  </span>
                ) : (
                  '开始分析'
                )}
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <button
              onClick={() => router.push('/dashboard/record')}
              className="card-modern p-6 text-left hover-lift hover-glow group animate-slide-up"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="3" />
                    <path
                      fillRule="evenodd"
                      d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">录制视频</h3>
                  <p className="text-sm text-neutral-600">使用摄像头录制</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/edit')}
              className="card-modern p-6 text-left hover-lift hover-glow group animate-slide-up"
              style={{ animationDelay: '0.25s' }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">视频编辑</h3>
                  <p className="text-sm text-neutral-600">裁剪 / 压缩 / 缩略图</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/history')}
              className="card-modern p-6 text-left hover-lift hover-glow group animate-slide-up"
              style={{ animationDelay: '0.3s' }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">历史记录</h3>
                  <p className="text-sm text-neutral-600">查看过往分析</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push('/dashboard/record?mode=realtime')}
              className="card-modern p-6 text-left hover-lift hover-glow group animate-slide-up"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-soft group-hover:shadow-glow transition-shadow">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-1">实时检测</h3>
                  <p className="text-sm text-neutral-600">摄像头实时姿态分析</p>
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
