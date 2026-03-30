import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

let poseLandmarker: PoseLandmarker | null = null;
let visionFileset: any = null;

// 本地模型路径（优先）和 CDN 路径（fallback）
const LOCAL_MODEL_PATH = '/models/pose_landmarker_lite.task';
const CDN_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm';

async function checkLocalModel(): Promise<boolean> {
  try {
    const resp = await fetch(LOCAL_MODEL_PATH, { method: 'HEAD' });
    return resp.ok;
  } catch {
    return false;
  }
}

/** 销毁当前实例，下次 initialize 时会重新创建（解决 timestamp 不单调递增问题） */
export function resetPoseLandmarker() {
  if (poseLandmarker) {
    try { poseLandmarker.close(); } catch (e) { /* ignore */ }
    poseLandmarker = null;
    console.log('[MediaPipe] 实例已重置');
  }
}

export async function initializePoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;

  // 缓存 vision fileset，不需要每次重新加载 WASM
  if (!visionFileset) {
    visionFileset = await FilesetResolver.forVisionTasks(WASM_CDN);
  }

  const hasLocalModel = await checkLocalModel();
  const modelPath = hasLocalModel ? LOCAL_MODEL_PATH : CDN_MODEL_PATH;

  if (hasLocalModel) {
    console.log('[MediaPipe] 使用本地模型文件');
  } else {
    console.warn('[MediaPipe] 本地模型不存在，尝试从 CDN 加载（需要翻墙）');
  }

  poseLandmarker = await PoseLandmarker.createFromOptions(visionFileset, {
    baseOptions: {
      modelAssetPath: modelPath,
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return poseLandmarker;
}

export async function analyzePoseFromVideo(
  videoElement: HTMLVideoElement,
  onProgress?: (progress: number) => void
) {
  // 每次新分析前重置实例，避免 timestamp 冲突
  resetPoseLandmarker();

  const landmarker = await initializePoseLandmarker();
  const results: any[] = [];

  const duration = videoElement.duration;
  if (!duration || !isFinite(duration)) {
    console.error('[MediaPipe] 视频 duration 无效:', duration);
    return results;
  }

  // 采样策略：每秒采样 6 帧（每 ~166ms 一帧）
  const sampleFPS = 6;
  const sampleInterval = 1 / sampleFPS;
  const totalSamples = Math.floor(duration * sampleFPS);
  let lastTimestamp = -1;
  let processedSamples = 0;

  console.log(`[MediaPipe] 视频时长: ${duration.toFixed(1)}s, 预计采样: ${totalSamples} 帧`);

  // 先尝试 seek 方式（对 MP4 等格式效果好）
  // 如果连续多次 seek 超时，自动切换到播放模式
  let seekFailCount = 0;
  const MAX_SEEK_FAILS = 5;
  let usePlaybackMode = false;

  // ========== 方式一：Seek 模式 ==========
  const analyzeWithSeek = async () => {
    for (let sampleIdx = 0; sampleIdx < totalSamples; sampleIdx++) {
      const seekTime = sampleIdx * sampleInterval;
      const timestamp = seekTime * 1000;

      // seek 到目标时间
      const seekSuccess = await new Promise<boolean>((resolve) => {
        if (Math.abs(videoElement.currentTime - seekTime) < 0.01) {
          resolve(true);
          return;
        }

        const timeout = setTimeout(() => {
          videoElement.onseeked = null;
          resolve(false);
        }, 800);

        videoElement.onseeked = () => {
          clearTimeout(timeout);
          videoElement.onseeked = null;
          resolve(true);
        };

        videoElement.currentTime = seekTime;
      });

      if (!seekSuccess) {
        seekFailCount++;
        if (seekFailCount >= MAX_SEEK_FAILS) {
          console.warn(`[MediaPipe] Seek 连续失败 ${MAX_SEEK_FAILS} 次，切换到播放模式`);
          usePlaybackMode = true;
          return; // 退出 seek 模式
        }
        continue; // 跳过这一帧
      }

      seekFailCount = 0; // 成功则重置计数

      // 确保 timestamp 严格递增
      const safeTimestamp = lastTimestamp >= timestamp ? lastTimestamp + 1 : timestamp;
      lastTimestamp = safeTimestamp;

      try {
        const result = landmarker.detectForVideo(videoElement, safeTimestamp);
        if (result.landmarks && result.landmarks.length > 0) {
          results.push({
            frameNumber: sampleIdx,
            timestamp: safeTimestamp,
            landmarks: result.landmarks[0],
            worldLandmarks: result.worldLandmarks?.[0],
          });
        }
      } catch (e) {
        console.warn(`[MediaPipe] 帧 ${sampleIdx} 检测失败:`, e);
      }

      processedSamples++;
      if (processedSamples % 30 === 0) {
        console.log(`[MediaPipe] Seek 进度: ${processedSamples}/${totalSamples}, 有效帧: ${results.length}`);
      }
      if (onProgress) {
        onProgress(Math.round((processedSamples / totalSamples) * 100));
      }
    }
  };

  // ========== 方式二：播放模式（WebM 兜底） ==========
  const analyzeWithPlayback = async () => {
    console.log('[MediaPipe] 使用播放模式分析');

    // 重置到开头
    videoElement.currentTime = 0;
    await new Promise<void>((resolve) => {
      const onSeeked = () => { videoElement.onseeked = null; resolve(); };
      videoElement.onseeked = onSeeked;
      setTimeout(resolve, 500);
    });

    videoElement.playbackRate = 2.0; // 2x 加速播放
    videoElement.muted = true;

    return new Promise<void>((resolve) => {
      let lastSampleTime = -sampleInterval;

      const onTimeUpdate = () => {
        const currentTime = videoElement.currentTime;

        // 按采样间隔采样
        if (currentTime - lastSampleTime < sampleInterval) return;
        lastSampleTime = currentTime;

        // 确保视频帧已就绪
        if (videoElement.readyState < 2) return;

        const timestamp = currentTime * 1000;
        const safeTimestamp = lastTimestamp >= timestamp ? lastTimestamp + 1 : timestamp;
        lastTimestamp = safeTimestamp;

        try {
          const result = landmarker.detectForVideo(videoElement, safeTimestamp);
          if (result.landmarks && result.landmarks.length > 0) {
            results.push({
              frameNumber: processedSamples,
              timestamp: safeTimestamp,
              landmarks: result.landmarks[0],
              worldLandmarks: result.worldLandmarks?.[0],
            });
          }
        } catch (e) {
          // 忽略单帧错误
        }

        processedSamples++;
        if (onProgress) {
          const progressEstimate = Math.min(100, Math.round((currentTime / duration) * 100));
          onProgress(progressEstimate);
        }
      };

      const onEnded = () => {
        videoElement.removeEventListener('timeupdate', onTimeUpdate);
        videoElement.removeEventListener('ended', onEnded);
        videoElement.pause();
        videoElement.playbackRate = 1.0;
        console.log(`[MediaPipe] 播放模式结束: 采样 ${processedSamples} 帧, 有效 ${results.length} 帧`);
        resolve();
      };

      // 超时保护：最多等 duration / playbackRate + 10 秒
      const maxWait = (duration / 2) * 1000 + 10000;
      const safetyTimeout = setTimeout(() => {
        console.warn('[MediaPipe] 播放模式超时，结束分析');
        onEnded();
      }, maxWait);

      videoElement.addEventListener('timeupdate', onTimeUpdate);
      videoElement.addEventListener('ended', () => {
        clearTimeout(safetyTimeout);
        onEnded();
      });

      videoElement.play().catch(() => {
        clearTimeout(safetyTimeout);
        console.error('[MediaPipe] 视频播放失败');
        onEnded();
      });
    });
  };

  // 先尝试 seek 模式
  await analyzeWithSeek();

  // 如果 seek 模式失败，切换到播放模式
  if (usePlaybackMode) {
    processedSamples = 0;
    lastTimestamp = -1;
    results.length = 0; // 清空之前的部分结果
    await analyzeWithPlayback();
  }

  console.log(`[MediaPipe] 分析完成: ${results.length} 帧有效数据`);
  return results;
}


export function calculateAngle(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number }
): number {
  const rad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs((rad * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

// ============ 关键点索引 ============

const LM = {
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

// ============ 工具函数 ============

function isVisible(lm: any, threshold = 0.5): boolean {
  return lm && (lm.visibility === undefined || lm.visibility > threshold);
}

function allVisible(landmarks: any[], indices: number[], threshold = 0.5): boolean {
  return indices.every(i => landmarks[i] && isVisible(landmarks[i], threshold));
}

/** 计算左右两侧的平均角度 */
function avgBilateral(landmarks: any[], l: [number, number, number], r: [number, number, number]): number {
  return (calculateAngle(landmarks[l[0]], landmarks[l[1]], landmarks[l[2]])
    + calculateAngle(landmarks[r[0]], landmarks[r[1]], landmarks[r[2]])) / 2;
}

/** 左右角度差 */
function bilateralDiff(landmarks: any[], l: [number, number, number], r: [number, number, number]): number {
  return Math.abs(
    calculateAngle(landmarks[l[0]], landmarks[l[1]], landmarks[l[2]])
    - calculateAngle(landmarks[r[0]], landmarks[r[1]], landmarks[r[2]])
  );
}

// ============ 评分规则配置 ============

interface AngleRule {
  name: string;           // 角度名称（用于 angles 输出）
  joints: { left: [number, number, number]; right: [number, number, number] };
  ideal: [number, number]; // 理想角度范围
  tolerance: number;       // 容差
  weight: number;          // 权重 (0-1)
  issues: { low?: string; high?: string }; // 超出范围时的提示
  lowThreshold?: number;   // 低于此值触发 low issue
  highThreshold?: number;  // 高于此值触发 high issue
}

interface ExerciseConfig {
  requiredPoints: number[];
  rules: AngleRule[];
  symmetryJoints?: { left: [number, number, number]; right: [number, number, number] };
  symmetryWeight?: number;
  validPoseCheck: (angles: Record<string, number>) => boolean;
}

function scoreAngle(angle: number, idealMin: number, idealMax: number, tolerance: number): number {
  if (angle >= idealMin && angle <= idealMax) return 100;
  const dev = angle < idealMin ? idealMin - angle : angle - idealMax;
  return Math.max(0, Math.round(100 - (dev / tolerance) * 100));
}

// ============ 运动配置 ============

const EXERCISE_CONFIGS: Record<string, ExerciseConfig> = {
  squat: {
    requiredPoints: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE, LM.R_HIP, LM.R_KNEE, LM.R_ANKLE, LM.L_SHOULDER, LM.R_SHOULDER],
    rules: [
      {
        name: 'knee',
        joints: { left: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], right: [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE] },
        ideal: [80, 120], tolerance: 30, weight: 0.5,
        issues: { low: '蹲得太低，可能对膝盖造成压力', high: '下蹲深度不足，建议再低一些' },
        lowThreshold: 60, highThreshold: 130,
      },
      {
        name: 'trunk',
        joints: { left: [LM.L_SHOULDER, LM.L_HIP, LM.L_KNEE], right: [LM.R_SHOULDER, LM.R_HIP, LM.R_KNEE] },
        ideal: [60, 100], tolerance: 20, weight: 0.3,
        issues: { low: '上身前倾过多，注意保持背部挺直' },
        lowThreshold: 50,
      },
    ],
    symmetryJoints: { left: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], right: [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE] },
    symmetryWeight: 0.2,
    validPoseCheck: (a) => a.knee < 150,
  },

  pushup: {
    requiredPoints: [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST, LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST, LM.L_HIP, LM.R_HIP],
    rules: [
      {
        name: 'elbow',
        joints: { left: [LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST], right: [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST] },
        ideal: [70, 110], tolerance: 25, weight: 0.5,
        issues: { high: '手臂弯曲不够，需要下降更多', low: '下降过低，注意保持控制' },
        lowThreshold: 50, highThreshold: 160,
      },
      {
        name: 'bodyLine',
        joints: { left: [LM.L_SHOULDER, LM.L_HIP, LM.L_KNEE], right: [LM.R_SHOULDER, LM.R_HIP, LM.R_KNEE] },
        ideal: [160, 180], tolerance: 20, weight: 0.5,
        issues: { low: '臀部下沉或上翘，保持身体成一条直线' },
        lowThreshold: 150,
      },
    ],
    validPoseCheck: (a) => a.elbow < 150 || a.bodyLine > 140,
  },

  plank: {
    requiredPoints: [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_HIP, LM.R_HIP, LM.L_KNEE, LM.R_KNEE, LM.L_ANKLE, LM.R_ANKLE],
    rules: [
      {
        name: 'bodyLine',
        joints: { left: [LM.L_SHOULDER, LM.L_HIP, LM.L_ANKLE], right: [LM.R_SHOULDER, LM.R_HIP, LM.R_ANKLE] },
        ideal: [165, 180], tolerance: 15, weight: 0.5,
        issues: { low: '身体不够平直，注意收紧核心' },
        lowThreshold: 155,
      },
      {
        name: 'hip',
        joints: { left: [LM.L_SHOULDER, LM.L_HIP, LM.L_KNEE], right: [LM.R_SHOULDER, LM.R_HIP, LM.R_KNEE] },
        ideal: [165, 180], tolerance: 15, weight: 0.5,
        issues: { low: '髋部弯曲过大，保持身体成一条直线' },
        lowThreshold: 150,
      },
    ],
    validPoseCheck: (a) => a.bodyLine > 130 && a.hip > 130,
  },

  lunge: {
    requiredPoints: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE, LM.R_HIP, LM.R_KNEE, LM.R_ANKLE, LM.L_SHOULDER, LM.R_SHOULDER],
    rules: [
      {
        name: 'frontKnee',
        joints: { left: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], right: [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE] },
        ideal: [80, 100], tolerance: 20, weight: 0.35,
        issues: { low: '前腿膝盖弯曲过深', high: '前腿下蹲不够' },
        lowThreshold: 70, highThreshold: 120,
      },
      {
        name: 'backKnee',
        joints: { left: [LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], right: [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE] },
        ideal: [80, 110], tolerance: 25, weight: 0.35,
        issues: { high: '后腿弯曲不够，膝盖应接近地面' },
        highThreshold: 150,
      },
      {
        name: 'trunk',
        joints: { left: [LM.L_SHOULDER, LM.L_HIP, LM.L_KNEE], right: [LM.R_SHOULDER, LM.R_HIP, LM.R_KNEE] },
        ideal: [60, 100], tolerance: 20, weight: 0.3,
        issues: { low: '上身前倾过多，保持直立' },
        lowThreshold: 50,
      },
    ],
    validPoseCheck: (a) => a.frontKnee < 140,
  },
};

// ============ 通用分析引擎 ============

export interface FrameAnalysis {
  score: number;
  angles: Record<string, number>;
  issues: string[];
  isValidPose: boolean;
}

function analyzeWithConfig(landmarks: any[], config: ExerciseConfig): FrameAnalysis {
  if (!allVisible(landmarks, config.requiredPoints)) {
    return { score: 0, angles: {}, issues: ['关键点不可见，无法分析'], isValidPose: false };
  }

  const angles: Record<string, number> = {};
  const issues: string[] = [];
  let weightedScore = 0;
  let totalWeight = 0;

  for (const rule of config.rules) {
    // 弓步蹲特殊处理：前腿取较小角度，后腿取较大角度
    let angle: number;
    if (rule.name === 'frontKnee') {
      const l = calculateAngle(landmarks[rule.joints.left[0]], landmarks[rule.joints.left[1]], landmarks[rule.joints.left[2]]);
      const r = calculateAngle(landmarks[rule.joints.right[0]], landmarks[rule.joints.right[1]], landmarks[rule.joints.right[2]]);
      angle = Math.min(l, r);
    } else if (rule.name === 'backKnee') {
      const l = calculateAngle(landmarks[rule.joints.left[0]], landmarks[rule.joints.left[1]], landmarks[rule.joints.left[2]]);
      const r = calculateAngle(landmarks[rule.joints.right[0]], landmarks[rule.joints.right[1]], landmarks[rule.joints.right[2]]);
      angle = Math.max(l, r);
    } else {
      angle = avgBilateral(landmarks, rule.joints.left, rule.joints.right);
    }

    angles[rule.name] = angle;

    const s = scoreAngle(angle, rule.ideal[0], rule.ideal[1], rule.tolerance);
    weightedScore += s * rule.weight;
    totalWeight += rule.weight;

    if (rule.lowThreshold !== undefined && angle < rule.lowThreshold && rule.issues.low) {
      issues.push(rule.issues.low);
    }
    if (rule.highThreshold !== undefined && angle > rule.highThreshold && rule.issues.high) {
      issues.push(rule.issues.high);
    }
  }

  // 对称性评分
  if (config.symmetryJoints && config.symmetryWeight) {
    const diff = bilateralDiff(landmarks, config.symmetryJoints.left, config.symmetryJoints.right);
    const symScore = Math.max(0, 100 - diff * 5);
    weightedScore += symScore * config.symmetryWeight;
    totalWeight += config.symmetryWeight;
    angles.symmetryDiff = diff;
    if (diff > 15) issues.push('左右角度不对称，注意均匀发力');
  }

  const score = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  const isValidPose = config.validPoseCheck(angles);

  return { score, angles, issues, isValidPose };
}

// ============ 导出的分析函数（保持向后兼容） ============

export type ExerciseType = 'squat' | 'pushup' | 'plank' | 'lunge';

export function analyzeSquat(landmarks: any[]): FrameAnalysis {
  return analyzeWithConfig(landmarks, EXERCISE_CONFIGS.squat);
}

export function analyzePushup(landmarks: any[]): FrameAnalysis {
  return analyzeWithConfig(landmarks, EXERCISE_CONFIGS.pushup);
}

export function analyzePlank(landmarks: any[]): FrameAnalysis {
  return analyzeWithConfig(landmarks, EXERCISE_CONFIGS.plank);
}

export function analyzeLunge(landmarks: any[]): FrameAnalysis {
  return analyzeWithConfig(landmarks, EXERCISE_CONFIGS.lunge);
}

export function analyzeFrame(landmarks: any[], exerciseType: ExerciseType): FrameAnalysis {
  const config = EXERCISE_CONFIGS[exerciseType];
  if (!config) {
    return { score: 0, angles: {}, issues: [`不支持的运动类型: ${exerciseType}`], isValidPose: false };
  }
  return analyzeWithConfig(landmarks, config);
}

// ============ 动作计数器（跨帧状态） ============

export interface RepCounter {
  count: number;
  phase: 'up' | 'down' | 'hold';
  minAngle: number;
  maxAngle: number;
}

/**
 * 创建一个动作计数器
 * angleKey: 用于判断阶段的角度名称
 * downThreshold: 低于此角度视为"下"阶段
 * upThreshold: 高于此角度视为"上"阶段
 */
export function createRepCounter(downThreshold: number, upThreshold: number): RepCounter {
  return { count: 0, phase: 'up', minAngle: 180, maxAngle: 0 };
}

/**
 * 更新计数器状态，返回是否完成了一次动作
 */
export function updateRepCounter(counter: RepCounter, angle: number, downThreshold: number, upThreshold: number): boolean {
  counter.minAngle = Math.min(counter.minAngle, angle);
  counter.maxAngle = Math.max(counter.maxAngle, angle);

  let completed = false;

  if (counter.phase === 'up' && angle < downThreshold) {
    counter.phase = 'down';
  } else if (counter.phase === 'down' && angle > upThreshold) {
    counter.phase = 'up';
    counter.count++;
    completed = true;
  }

  return completed;
}
