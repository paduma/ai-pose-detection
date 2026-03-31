'use client';

import { useRef, useState, useEffect } from 'react';
import {
  initializePoseLandmarker,
  analyzePoseFromVideo,
  analyzeFrame,
  ExerciseType,
  FrameAnalysis,
} from '@/lib/mediapipe';

interface VideoAnalyzerProps {
  videoFile: File;
  exerciseType: string;
  onAnalysisComplete: (results: any) => void;
}

const STEPS = [
  { key: 'load', label: '加载视频', icon: '📹' },
  { key: 'init', label: '初始化 AI 模型', icon: '🧠' },
  { key: 'analyze', label: '逐帧姿态分析', icon: '🔍' },
  { key: 'report', label: '生成评估报告', icon: '📊' },
];

export default function VideoAnalyzer({ videoFile, exerciseType, onAnalysisComplete }: VideoAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [detectedFrames, setDetectedFrames] = useState(0);
  const [totalSamples, setTotalSamples] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 计时器
    timerRef.current = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);

    analyzeVideo();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const analyzeVideo = async () => {
    if (!videoRef.current) return;

    try {
      // Step 1: 加载视频
      setCurrentStep(0);
      setProgress(5);
      const videoUrl = URL.createObjectURL(videoFile);
      const video = videoRef.current!;

      // 先绑定事件，再设置 src，避免事件在绑定前触发
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('视频加载超时')), 30000);

        const onLoaded = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          resolve();
        };

        const onError = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          reject(new Error('视频加载失败，请检查文件格式'));
        };

        // 如果视频已经加载好了（readyState >= 2），直接 resolve
        if (video.readyState >= 2) {
          clearTimeout(timeout);
          resolve();
          return;
        }

        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('error', onError);
      });

      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;
      video.src = videoUrl;
      video.load();

      await loadPromise;

      const duration = videoRef.current.duration;
      const estimatedSamples = Math.floor((duration * 30) / 5);
      setTotalSamples(estimatedSamples);
      setProgress(10);

      // Step 2: 初始化 AI 模型（会在 analyzePoseFromVideo 内部完成）
      setCurrentStep(1);
      setProgress(12);
      // 预热：确保模型加载完成再进入分析阶段
      await initializePoseLandmarker();
      setProgress(15);

      // Step 3: 逐帧分析（内部会 reset + 重新初始化以确保 timestamp 干净）
      setCurrentStep(2);
      const poseResults = await analyzePoseFromVideo(videoRef.current, (p) => {
        // p 已经是 0-100，映射到 15-85 的进度区间
        const mappedProgress = 15 + Math.round(p * 0.7);
        setProgress(mappedProgress);
        // 实时更新已检测帧数（粗略估计）
        setDetectedFrames(Math.round((p / 100) * estimatedSamples));
      });

      setDetectedFrames(poseResults.length);

      // Step 4: 生成报告
      setCurrentStep(3);
      setProgress(90);
      const analysis = generateAnalysisReport(poseResults, exerciseType as ExerciseType);
      setProgress(100);

      // 停止计时
      if (timerRef.current) clearInterval(timerRef.current);

      // 短暂延迟让用户看到 100%
      await new Promise((r) => setTimeout(r, 500));
      onAnalysisComplete(analysis);

      URL.revokeObjectURL(videoUrl);
    } catch (err) {
      console.error('分析失败:', err);
      setError(err instanceof Error ? err.message : '分析失败');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const generateAnalysisReport = (poseResults: any[], exerciseType: ExerciseType) => {
    const totalDetectedFrames = poseResults.length;

    console.log(`[Report] 总检测帧数: ${totalDetectedFrames}`);

    if (totalDetectedFrames === 0) {
      return {
        score: 0, totalFrames: 0, detectedFrames: 0, validPoseFrames: 0,
        poseDetectionRate: 0, keyPoints: [],
        recommendations: ['未检测到人体姿态，请确保视频中有清晰的人体画面'],
        issues: ['未检测到任何姿态数据'],
        metrics: { angleAccuracy: 0, positionStability: 0, movementSmooth: 0 },
        angleData: [],
      };
    }

    const frameAnalyses: FrameAnalysis[] = poseResults.map((result) =>
      analyzeFrame(result.landmarks, exerciseType)
    );

    // 有分数的帧（score > 0，即关键点可见）
    const scoredFrames = frameAnalyses.filter((f) => f.score > 0 || f.isValidPose);
    // 严格有效姿态帧
    const validFrames = frameAnalyses.filter((f) => f.isValidPose);
    const validPoseFrames = validFrames.length;

    // 使用 scoredFrames 来计算，而不是只用 validFrames
    // 这样即使没有"标准姿态"帧，也能给出有意义的分数
    const effectiveFrames = validPoseFrames > 0 ? validFrames : scoredFrames;
    const effectiveCount = effectiveFrames.length;

    const poseDetectionRate = Math.round((effectiveCount / totalDetectedFrames) * 100);

    console.log(`[Report] 有效姿态帧: ${validPoseFrames}, 有分数帧: ${scoredFrames.length}, 使用: ${effectiveCount}`);

    const allIssues: string[] = [];
    frameAnalyses.forEach((f) => allIssues.push(...f.issues));
    const uniqueIssues = Array.from(new Set(allIssues.filter(i => i !== '关键点不可见，无法分析')));

    const angleData = effectiveFrames
      .map((f) => {
        const angles = Object.values(f.angles);
        return angles.length > 0 ? angles[0] : 0;
      })
      .filter((v) => v > 0);

    let score: number;
    if (effectiveCount === 0) {
      score = 0;
    } else {
      const avgFrameScore = effectiveFrames.reduce((sum, f) => sum + f.score, 0) / effectiveCount;
      const detectionScore = Math.min(100, poseDetectionRate);
      let stabilityScore = 100;
      if (angleData.length > 1) {
        const stdDev = calcStdDev(angleData);
        stabilityScore = Math.max(0, Math.min(100, Math.round(100 - (stdDev - 5) * (100 / 25))));
      }
      score = Math.round(avgFrameScore * 0.6 + detectionScore * 0.2 + stabilityScore * 0.2);

      // 如果没有严格有效姿态帧，说明动作不匹配，给一个低分但不是0
      if (validPoseFrames === 0 && score > 30) {
        score = Math.min(score, 30);
        uniqueIssues.unshift('未检测到标准的' + getExerciseLabel(exerciseType) + '姿态，请确认动作是否正确');
      }

      console.log(`[Report] 平均帧分: ${avgFrameScore.toFixed(1)}, 检测率: ${detectionScore}, 稳定性: ${stabilityScore}, 最终: ${score}`);
    }

    const recommendations = buildRecommendations(exerciseType, uniqueIssues, poseDetectionRate, score);

    return {
      score, totalFrames: totalDetectedFrames * 5, detectedFrames: totalDetectedFrames,
      validPoseFrames, poseDetectionRate, keyPoints: poseResults.slice(0, 10),
      recommendations, issues: uniqueIssues,
      metrics: {
        angleAccuracy: effectiveCount > 0
          ? Math.round(effectiveFrames.reduce((sum, f) => sum + f.score, 0) / effectiveCount) : 0,
        positionStability: angleData.length > 1
          ? Math.max(0, Math.round(100 - calcStdDev(angleData) * 2)) : 0,
        movementSmooth: poseDetectionRate,
      },
      angleData,
    };
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ============ UI ============

  if (error) {
    return (
      <div className="card-modern p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">分析失败</h3>
        <p className="text-neutral-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-gradient"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <video ref={videoRef} className="hidden" preload="auto" />

      {/* 主卡片 */}
      <div className="card-modern p-8">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl shadow-glow mb-4">
            <span className="text-3xl">{STEPS[currentStep]?.icon || '🔍'}</span>
          </div>
          <h3 className="text-2xl font-bold text-neutral-900 mb-1">
            AI 姿态分析中
          </h3>
          <p className="text-neutral-500">
            {videoFile.name} · {(videoFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>

        {/* 进度条 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-neutral-700">
              {STEPS[currentStep]?.label || '处理中'}...
            </span>
            <div className="flex items-center space-x-3 text-sm text-neutral-500">
              <span>⏱ {formatTime(elapsedTime)}</span>
              <span className="font-mono font-semibold text-primary-600">{progress}%</span>
            </div>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #0ea5e9, #a855f7)',
              }}
            />
          </div>
        </div>

        {/* 步骤指示器 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {STEPS.map((step, idx) => (
            <div
              key={step.key}
              className={`flex flex-col items-center p-3 rounded-xl transition-all duration-300 ${idx < currentStep
                ? 'bg-green-50'
                : idx === currentStep
                  ? 'bg-primary-50 ring-2 ring-primary-200'
                  : 'bg-neutral-50'
                }`}
            >
              <span className="text-xl mb-1">
                {idx < currentStep ? '✅' : step.icon}
              </span>
              <span className={`text-xs font-medium text-center ${idx === currentStep ? 'text-primary-700' : idx < currentStep ? 'text-green-700' : 'text-neutral-400'
                }`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* 实时统计 */}
        {currentStep >= 2 && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-neutral-50 rounded-xl animate-fade-in">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">{detectedFrames}</div>
              <div className="text-xs text-neutral-500">已检测帧数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary-600">
                {totalSamples > 0 ? `~${totalSamples}` : '-'}
              </div>
              <div className="text-xs text-neutral-500">预计总帧数</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{formatTime(elapsedTime)}</div>
              <div className="text-xs text-neutral-500">已用时间</div>
            </div>
          </div>
        )}
      </div>

      {/* 提示 */}
      <div className="card-modern p-4 bg-gradient-to-r from-primary-50 to-secondary-50">
        <div className="flex items-center space-x-3">
          <span className="text-lg">💡</span>
          <p className="text-sm text-neutral-600">
            分析时间取决于视频长度和设备性能。较长的视频可能需要几分钟，请耐心等待。
          </p>
        </div>
      </div>
    </div>
  );
}

function calcStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getExerciseLabel(type: string): string {
  const labels: Record<string, string> = {
    squat: '深蹲', pushup: '俯卧撑', plank: '平板支撑', lunge: '弓步蹲',
  };
  return labels[type] || type;
}

function buildRecommendations(
  exerciseType: ExerciseType,
  issues: string[],
  poseDetectionRate: number,
  score: number
): string[] {
  const recs: string[] = [];

  if (poseDetectionRate < 30) {
    recs.push('视频中未检测到足够的目标运动姿态，请确认视频内容与所选运动类型匹配');
    recs.push('建议：确保全身在画面中，光线充足，背景简洁');
    return recs;
  }

  if (poseDetectionRate < 60) {
    recs.push('部分帧未检测到有效姿态，建议改善拍摄角度和光线条件');
  }

  const baseAdvice: Record<string, string[]> = {
    squat: ['保持背部挺直，核心收紧', '膝盖方向与脚尖一致', '下蹲至大腿与地面平行'],
    pushup: ['保持身体从头到脚成一条直线', '手臂与肩同宽，肘部向后收', '下降时胸部接近地面'],
    plank: ['保持身体成一条直线，不要塌腰或撅臀', '肘部在肩膀正下方', '保持均匀呼吸，核心持续收紧'],
    lunge: ['前膝盖不超过脚尖', '后膝盖接近地面但不触地', '保持上身直立，重心在两腿之间'],
  };

  if (score >= 80) recs.push('姿态整体良好，继续保持！');
  else if (score >= 60) recs.push('姿态基本正确，注意以下细节可以进一步提升：');
  else recs.push('姿态需要改善，请重点关注以下问题：');

  issues.forEach((issue) => recs.push(issue));

  if (issues.length < 2) {
    (baseAdvice[exerciseType] || []).forEach((a) => {
      if (!recs.includes(a)) recs.push(a);
    });
  }

  return recs;
}
