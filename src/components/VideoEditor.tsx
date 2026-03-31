'use client';

import { useState, useRef, useEffect } from 'react';
import { loadFFmpeg, extractThumbnail, compressVideo, trimVideo } from '@/lib/ffmpegClient';

type Tab = 'trim' | 'compress' | 'thumbnail';

export default function VideoEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('trim');
  const [loading, setLoading] = useState(false);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // trim params
  const [startTime, setStartTime] = useState(0);
  const [duration, setDuration] = useState(5);
  const [videoDuration, setVideoDuration] = useState(0);

  // compress params
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFFmpeg()
      .then(() => setFfmpegReady(true))
      .catch((err) => setError(err.message || 'FFmpeg 加载失败，请刷新重试'));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setResultUrl(null);
    setThumbnailUrl(null);
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setVideoDuration(dur);
      setDuration(Math.min(5, dur));
    }
  };

  const handleTrim = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const blob = await trimVideo(file, startTime, duration, setProgress);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setError(err.message || '裁剪失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCompress = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(0);
    setError(null);
    try {
      const blob = await compressVideo(file, quality, setProgress);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setError(err.message || '压缩失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractThumbnail = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await extractThumbnail(file);
      setThumbnailUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setError(err.message || '提取缩略图失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `edited_${file?.name || 'video'}.mp4`;
    a.click();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'trim', label: '视频裁剪', icon: '✂️' },
    { key: 'compress', label: '视频压缩', icon: '📦' },
    { key: 'thumbnail', label: '提取缩略图', icon: '🖼️' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="animate-slide-up">
        <h2 className="text-4xl font-bold text-neutral-900 mb-2">视频编辑</h2>
        <p className="text-lg text-neutral-600">
          基于 FFmpeg.wasm 的浏览器端视频处理
          {!ffmpegReady && <span className="text-amber-600 ml-2">（FFmpeg 加载中...）</span>}
        </p>
      </div>

      {/* File Select */}
      <div className="card-modern p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} className="btn-gradient" disabled={!ffmpegReady}>
          选择视频文件
        </button>
        {file && <span className="ml-4 text-neutral-600">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</span>}
      </div>

      {/* Video Preview */}
      {videoUrl && (
        <div className="card-modern p-6 animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <video ref={videoRef} src={videoUrl} controls onLoadedMetadata={handleVideoLoaded} className="w-full max-h-80 rounded-xl bg-black" />
        </div>
      )}

      {/* Tabs */}
      {file && (
        <div className="card-modern p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex space-x-2 mb-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setResultUrl(null); }}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${activeTab === t.key
                  ? 'bg-primary-500 text-white shadow-soft'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Trim Panel */}
          {activeTab === 'trim' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">开始时间 (秒)</label>
                  <input
                    type="number" min={0} max={videoDuration} step={0.1} value={startTime}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">持续时间 (秒)</label>
                  <input
                    type="number" min={0.1} max={videoDuration - startTime} step={0.1} value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button onClick={handleTrim} disabled={loading} className="btn-gradient">
                {loading ? `裁剪中... ${progress}%` : '开始裁剪'}
              </button>
            </div>
          )}

          {/* Compress Panel */}
          {activeTab === 'compress' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">压缩质量</label>
                <div className="flex space-x-3">
                  {(['low', 'medium', 'high'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`px-5 py-2 rounded-xl font-medium transition-all ${quality === q ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                    >
                      {{ low: '低质量 (小体积)', medium: '中等质量', high: '高质量 (大体积)' }[q]}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleCompress} disabled={loading} className="btn-gradient">
                {loading ? `压缩中... ${progress}%` : '开始压缩'}
              </button>
            </div>
          )}

          {/* Thumbnail Panel */}
          {activeTab === 'thumbnail' && (
            <div className="space-y-4">
              <button onClick={handleExtractThumbnail} disabled={loading} className="btn-gradient">
                {loading ? '提取中...' : '提取首帧缩略图'}
              </button>
              {thumbnailUrl && (
                <div className="mt-4">
                  <img src={thumbnailUrl} alt="缩略图" className="max-w-sm rounded-xl shadow-soft" />
                  <a href={thumbnailUrl} download="thumbnail.jpg" className="inline-block mt-2 text-primary-600 hover:underline text-sm">
                    下载缩略图
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card-modern p-4 bg-red-50 border-red-200 text-red-700 animate-scale-in">
          {error}
        </div>
      )}

      {/* Result */}
      {resultUrl && (
        <div className="card-modern p-6 animate-scale-in">
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">处理结果</h3>
          <video src={resultUrl} controls className="w-full max-h-80 rounded-xl bg-black mb-4" />
          <button onClick={downloadResult} className="btn-gradient">下载视频</button>
        </div>
      )}

      {/* Progress Bar */}
      {loading && progress > 0 && (
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
