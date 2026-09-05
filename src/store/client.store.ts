import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ClientUser {
  id:       string;
  email:    string;
  role:     string;
  tenantId: string;
  firstName: string;
  lastName:  string;
}

interface ClientAuthState {
  accessToken:  string | null;
  refreshToken: string | null;
  user:         ClientUser | null;
  setAuth: (access: string, refresh: string, user: ClientUser) => void;
  logout:  () => void;
}

export const useClientStore = create<ClientAuthState>()(
  persist(
    (set) => ({
      accessToken:  null,
      refreshToken: null,
      user:         null,
      setAuth: (accessToken, refreshToken, user) => set({ accessToken, refreshToken, user }),
      logout:  () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'insumitra-client-auth' },
  ),
);
