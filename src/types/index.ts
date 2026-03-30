// 用户类型
export interface User {
  _id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser extends User {
  token: string;
}

// 姿态检测结果
export interface PoseKeypoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  name: string;
}

export interface PoseResult {
  _id: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  keypoints: PoseKeypoint[][];
  metadata: {
    duration: number;
    fps: number;
    frameCount: number;
    resolution: {
      width: number;
      height: number;
    };
  };
  analysis: {
    posture: 'good' | 'fair' | 'poor';
    score: number;
    issues: string[];
    recommendations: string[];
  };
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

// 上传状态
export interface UploadProgress {
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  message?: string;
}

// API 响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 统计数据
export interface Statistics {
  totalAnalyses: number;
  averageScore: number;
  recentAnalyses: PoseResult[];
  scoreDistribution: {
    good: number;
    fair: number;
    poor: number;
  };
}
