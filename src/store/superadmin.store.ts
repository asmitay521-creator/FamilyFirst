import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SuperAdminState {
  accessToken: string | null;
  admin: { id: string; email: string; name: string } | null;
  setAuth: (token: string, admin: SuperAdminState['admin']) => void;
  logout:  () => void;
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set) => ({
      accessToken: null,
      admin:       null,
      setAuth: (accessToken, admin) => {
        set({ accessToken, admin });
      },
      logout: () => {
        set({ accessToken: null, admin: null });
      },
    }),
    {
      name: 'insumitra-superadmin',
    },
  ),
);
