// Zustand 状态管理 - 认证
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser, User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;

  // Actions
  setUser: (user: AuthUser | User) => void;
  setToken: (token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,

      setUser: (authUser: AuthUser | User) => {
        if ('token' in authUser) {
          const { token, ...user } = authUser;
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({
            user: authUser,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      },

      setToken: (token: string) => {
        set({ token });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
