// Zustand 状态管理 - 上传
import { create } from 'zustand';
import { UploadProgress } from '@/types';

interface UploadState extends UploadProgress {
  file: File | null;
  resultId: string | null;

  // Actions
  setFile: (file: File | null) => void;
  setProgress: (progress: number) => void;
  setStatus: (status: UploadProgress['status']) => void;
  setMessage: (message: string) => void;
  setResultId: (id: string) => void;
  setUploadProgress: (progress: number) => void;
  setAnalysisId: (id: string) => void;
  reset: () => void;
}

const initialState = {
  file: null,
  progress: 0,
  status: 'idle' as const,
  message: undefined,
  resultId: null,
};

export const useUploadStore = create<UploadState>((set) => ({
  ...initialState,

  setFile: (file) => set({ file }),

  setProgress: (progress) => set({ progress }),

  setStatus: (status) => set({ status }),

  setMessage: (message) => set({ message }),

  setResultId: (resultId) => set({ resultId }),

  setUploadProgress: (progress) => set({ progress }),

  setAnalysisId: (resultId) => set({ resultId }),

  reset: () => set(initialState),
}));
