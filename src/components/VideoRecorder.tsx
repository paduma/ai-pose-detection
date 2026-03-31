'use client';

import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';

interface VideoRecorderProps {
  onRecordingComplete?: (videoBlob: Blob, videoUrl: string) => void;
  maxDuration?: number; // 最大录制时长（秒）
}

export default function VideoRecorder({
  onRecordingComplete,
  maxDuration = 60
}: VideoRecorderProps) {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 摄像头配置
  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: 'user',
  };

  const [retryKey, setRetryKey] = useState(0);

  const handleUserMedia = () => {
    setCameraReady(true);
    setError(null);
  };

  const handleUserMediaError = (err: any) => {
    console.error('摄像头访问错误:', err);
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      setError('摄像头权限被拒绝，请在浏览器地址栏左侧点击图标允许摄像头访问，然后点击下方"重试"按钮');
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      setError('未检测到摄像头设备');
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      setError('摄像头被其他应用占用，请关闭后重试');
    } else {
      setError('无法访问摄像头，请检查权限设置后点击"重试"');
    }
    setCameraReady(false);
  };

  const retryCamera = () => {
    setError(null);
    setCameraReady(false);
    setRetryKey((k) => k + 1);
  };

  const startRecording = useCallback(() => {
    if (!webcamRef.current?.stream) {
      setError('摄像头未就绪');
      return;
    }

    try {
      chunksRef.current = [];
      const stream = webcamRef.current.stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideo(url);

        if (onRecordingComplete) {
          onRecordingComplete(blob, url);
        }

        // 清理定时器
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start(100); // 每100ms收集一次数据
      setIsRecording(true);
      setRecordingTime(0);

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      console.error('录制启动失败:', err);
      setError('录制启动失败');
    }
  }, [maxDuration, onRecordingComplete]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // 恢复计时
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    }
  }, [isRecording, isPaused, maxDuration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording]);

  const resetRecording = () => {
    setRecordedVideo(null);
    setRecordingTime(0);
    chunksRef.current = [];
  };

  const downloadVideo = () => {
    if (recordedVideo) {
      const a = document.createElement('a');
      a.href = recordedVideo;
      a.download = `recording-${Date.now()}.webm`;
      a.click();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* 视频预览区域 */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        {!recordedVideo ? (
          <>
            <Webcam
              key={retryKey}
              ref={webcamRef}
              audio={true}
              videoConstraints={videoConstraints}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="w-full h-full object-cover"
              mirrored
            />

            {/* 录制状态指示器 */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-2 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-white animate-pulse'}`} />
                <span className="font-mono font-bold">{formatTime(recordingTime)}</span>
                {isPaused && <span className="text-sm">已暂停</span>}
              </div>
            )}

            {/* 最大时长提示 */}
            {isRecording && (
              <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                最长 {formatTime(maxDuration)}
              </div>
            )}
          </>
        ) : (
          <video
            src={recordedVideo}
            controls
            className="w-full h-full object-cover"
          />
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-white text-center p-6">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-lg font-medium mb-4">{error}</p>
              <button
                onClick={retryCamera}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                重试
              </button>
            </div>
          </div>
        )}

        {/* 加载中 */}
        {!cameraReady && !error && !recordedVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
              <p>正在启动摄像头...</p>
            </div>
          </div>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center space-x-4">
        {!recordedVideo ? (
          <>
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={!cameraReady}
                className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" />
                </svg>
                <span>开始录制</span>
              </button>
            ) : (
              <>
                {!isPaused ? (
                  <button
                    onClick={pauseRecording}
                    className="flex items-center space-x-2 px-6 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                    </svg>
                    <span>暂停</span>
                  </button>
                ) : (
                  <button
                    onClick={resumeRecording}
                    className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6 4l10 6-10 6V4z" />
                    </svg>
                    <span>继续</span>
                  </button>
                )}

                <button
                  onClick={stopRecording}
                  className="flex items-center space-x-2 px-6 py-3 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-900 transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <rect x="4" y="4" width="12" height="12" />
                  </svg>
                  <span>停止</span>
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={resetRecording}
              className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>重新录制</span>
            </button>

            <button
              onClick={downloadVideo}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>下载视频</span>
            </button>
          </>
        )}
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg
            className="w-5 h-5 text-blue-600 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">录制提示：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>确保光线充足，全身在画面中</li>
              <li>保持摄像头稳定，避免晃动</li>
              <li>最长录制时间：{formatTime(maxDuration)}</li>
              <li>录制完成后可以下载或直接使用</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
