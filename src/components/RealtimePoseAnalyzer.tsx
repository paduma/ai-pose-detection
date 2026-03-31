'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import {
  initializePoseLandmarker,
  analyzeFrame,
  calculateAngle,
  ExerciseType,
  FrameAnalysis,
} from '@/lib/mediapipe';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

interface RealtimePoseAnalyzerProps {
  exerciseType: ExerciseType;
  onSessionComplete?: (summary: SessionSummary) => void;
}

interface SessionSummary {
  duration: number;
  totalFrames: number;
  avgScore: number;
  issues: string[];
  recommendations: string[];
  scoreHistory: number[];
}

// MediaPipe Pose 骨骼连接线
const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], // 肩膀
  [11, 13], [13, 15], // 左臂
  [12, 14], [14, 16], // 右臂
  [11, 23], [12, 24], // 躯干
  [23, 24], // 髋部
  [23, 25], [25, 27], // 左腿
  [24, 26], [26, 28], // 右腿
];

const EXERCISE_LABELS: Record<string, string> = {
  squat: '深蹲', pushup: '俯卧撑', plank: '平板支撑', lunge: '弓步蹲',
};

export default function RealtimePoseAnalyzer({
  exerciseType,
  onSessionComplete,
}: RealtimePoseAnalyzerProps) {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastTimestampRef = useRef<number>(-1);

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 实时数据
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentIssues, setCurrentIssues] = useState<string[]>([]);
  const [currentAngles, setCurrentAngles] = useState<Record<string, number>>({});
  const [fps, setFps] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  // 历史数据
  const scoreHistoryRef = useRef<number[]>([]);
  const allIssuesRef = useRef<string[]>([]);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    return () => {
      stopAnalysis();
    };
  }, []);

  const handleUserMedia = () => {
    setCameraReady(true);
    setError(null);
  };

  const handleUserMediaError = () => {
    setError('无法访问摄像头，请检查权限');
    setCameraReady(false);
  };

  const startAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const landmarker = await initializePoseLandmarker();
      landmarkerRef.current = landmarker;

      // 切换到 VIDEO 模式（实时用 VIDEO 模式 + 递增 timestamp）
      setIsRunning(true);
      setSessionTime(0);
      setFrameCount(0);
      scoreHistoryRef.current = [];
      allIssuesRef.current = [];
      lastTimestampRef.current = -1;

      // 开始计时
      sessionTimerRef.current = setInterval(() => {
        setSessionTime((t) => t + 1);
      }, 1000);

      // 开始检测循环
      detectFrame();
    } catch (err) {
      setError('AI 模型加载失败: ' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setIsLoading(false);
    }
  };

  const stopAnalysis = useCallback(() => {
    setIsRunning(false);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // 生成会话总结
    if (onSessionComplete && scoreHistoryRef.current.length > 0) {
      const scores = scoreHistoryRef.current;
      const uniqueIssues = Array.from(new Set(allIssuesRef.current));
      onSessionComplete({
        duration: sessionTime,
        totalFrames: scores.length,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        issues: uniqueIssues,
        recommendations: [],
        scoreHistory: scores,
      });
    }
  }, [sessionTime, onSessionComplete]);

  const detectFrame = useCallback(() => {
    const webcam = webcamRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!webcam?.video || !canvas || !landmarker || webcam.video.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const video = webcam.video;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 同步 canvas 尺寸
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 确保 timestamp 严格递增
    const now = performance.now();
    const timestamp = lastTimestampRef.current >= now ? lastTimestampRef.current + 1 : now;
    lastTimestampRef.current = timestamp;

    try {
      const result = landmarker.detectForVideo(video, timestamp);

      // 清空 canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];

        // 绘制骨骼
        drawSkeleton(ctx, landmarks, canvas.width, canvas.height);

        // 分析姿态
        const analysis = analyzeFrame(landmarks, exerciseType);

        setCurrentScore(analysis.score);
        setCurrentIssues(analysis.issues);
        setCurrentAngles(analysis.angles);
        setFrameCount((c) => c + 1);

        if (analysis.isValidPose) {
          scoreHistoryRef.current.push(analysis.score);
        }
        analysis.issues.forEach((i) => allIssuesRef.current.push(i));

        // 绘制评分
        drawScoreOverlay(ctx, analysis, canvas.width);
      } else {
        setCurrentScore(null);
        setCurrentIssues(['未检测到人体']);
      }

      // FPS 计算
      fpsCounterRef.current.frames++;
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setFps(fpsCounterRef.current.frames);
        fpsCounterRef.current = { frames: 0, lastTime: now };
      }
    } catch (e) {
      // 单帧失败不中断
    }

    animationRef.current = requestAnimationFrame(detectFrame);
  }, [exerciseType]);

  // 当 isRunning 变化时启动/停止检测循环
  useEffect(() => {
    if (isRunning) {
      detectFrame();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, detectFrame]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="space-y-4">
      {/* 视频 + Canvas 叠加 */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
        <Webcam
          key={retryKey}
          ref={webcamRef}
          audio={false}
          videoConstraints={{ width: 1280, height: 720, facingMode: 'user' }}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          className="w-full h-full object-cover"
          mirrored
        />

        {/* 骨骼叠加层 */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* 顶部状态栏 */}
        {isRunning && (
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-lg">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-sm font-semibold">{formatTime(sessionTime)}</span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm">
                {fps} FPS
              </div>
              <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm">
                {EXERCISE_LABELS[exerciseType]}
              </div>
            </div>
          </div>
        )}

        {/* 实时评分（大字） */}
        {isRunning && currentScore !== null && (
          <div className="absolute bottom-4 right-4">
            <div
              className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm"
              style={{
                backgroundColor: `${getScoreColor(currentScore)}dd`,
              }}
            >
              <span className="text-white text-2xl font-bold">{currentScore}</span>
              <span className="text-white/80 text-xs">分</span>
            </div>
          </div>
        )}

        {/* 实时问题提示 */}
        {isRunning && currentIssues.length > 0 && currentIssues[0] !== '未检测到人体' && (
          <div className="absolute bottom-4 left-4 max-w-[60%]">
            {currentIssues.slice(0, 2).map((issue, idx) => (
              <div
                key={idx}
                className="bg-red-500/80 backdrop-blur-sm text-white text-sm px-3 py-1.5 rounded-lg mb-1"
              >
                ⚠️ {issue}
              </div>
            ))}
          </div>
        )}

        {/* 加载中 */}
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
              <p>正在启动摄像头...</p>
            </div>
          </div>
        )}

        {/* 错误 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/75">
            <div className="text-white text-center p-6">
              <p className="text-lg font-medium mb-4">{error}</p>
              <button
                onClick={() => { setError(null); setRetryKey((k) => k + 1); }}
                className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center space-x-4">
        {!isRunning ? (
          <button
            onClick={startAnalysis}
            disabled={!cameraReady || isLoading}
            className="btn-gradient flex items-center space-x-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>加载 AI 模型...</span>
              </>
            ) : (
              <>
                <span className="text-lg">▶️</span>
                <span>开始实时分析</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={stopAnalysis}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition"
          >
            <span className="text-lg">⏹</span>
            <span>停止分析</span>
          </button>
        )}
      </div>

      {/* 实时数据面板 */}
      {isRunning && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card-modern p-4 text-center">
            <div className="text-2xl font-bold" style={{ color: currentScore !== null ? getScoreColor(currentScore) : '#9ca3af' }}>
              {currentScore !== null ? currentScore : '-'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">当前评分</div>
          </div>
          <div className="card-modern p-4 text-center">
            <div className="text-2xl font-bold text-primary-600">
              {scoreHistoryRef.current.length > 0
                ? Math.round(scoreHistoryRef.current.reduce((a, b) => a + b, 0) / scoreHistoryRef.current.length)
                : '-'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">平均评分</div>
          </div>
          <div className="card-modern p-4 text-center">
            <div className="text-2xl font-bold text-secondary-600">{frameCount}</div>
            <div className="text-xs text-neutral-500 mt-1">已分析帧</div>
          </div>
          <div className="card-modern p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatTime(sessionTime)}</div>
            <div className="text-xs text-neutral-500 mt-1">训练时长</div>
          </div>
        </div>
      )}

      {/* 关键角度数据 */}
      {isRunning && Object.keys(currentAngles).length > 0 && (
        <div className="card-modern p-4">
          <h4 className="text-sm font-semibold text-neutral-700 mb-3">关键角度数据</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(currentAngles).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                <span className="text-xs text-neutral-600">{formatAngleName(key)}</span>
                <span className="text-sm font-mono font-semibold text-neutral-900">{Math.round(value)}°</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ 绘制函数 ============

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  width: number,
  height: number
) {
  // 绘制连接线
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 3;

  for (const [start, end] of POSE_CONNECTIONS) {
    const p1 = landmarks[start];
    const p2 = landmarks[end];
    if (!p1 || !p2) continue;
    if ((p1.visibility ?? 1) < 0.5 || (p2.visibility ?? 1) < 0.5) continue;

    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  }

  // 绘制关键点
  for (let i = 11; i <= 28; i++) {
    const lm = landmarks[i];
    if (!lm || (lm.visibility ?? 1) < 0.5) continue;

    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#00ff88';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawScoreOverlay(
  ctx: CanvasRenderingContext2D,
  analysis: FrameAnalysis,
  canvasWidth: number
) {
  if (!analysis.isValidPose) return;

  // 不在 canvas 上画评分了，用 React DOM 显示更清晰
}

function formatAngleName(key: string): string {
  const names: Record<string, string> = {
    leftKneeAngle: '左膝角度',
    rightKneeAngle: '右膝角度',
    avgKneeAngle: '平均膝角',
    avgTrunkAngle: '躯干角度',
    kneeDiff: '左右差异',
    leftElbowAngle: '左肘角度',
    rightElbowAngle: '右肘角度',
    avgElbowAngle: '平均肘角',
    avgBodyLine: '身体直线度',
    avgHipAngle: '髋部角度',
    frontKneeAngle: '前膝角度',
    backKneeAngle: '后膝角度',
  };
  return names[key] || key;
}
