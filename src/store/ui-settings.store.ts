import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontSizeLevel = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const FONT_SIZE_MAP: Record<FontSizeLevel, { px: number; label: string; desc: string }> = {
  xs: { px: 11,   label: 'Extra Small', desc: 'Very compact — fits more on screen' },
  sm: { px: 12,   label: 'Small',       desc: 'Compact layout for desktop users' },
  md: { px: 13.5, label: 'Default',     desc: 'Balanced — recommended for most screens' },
  lg: { px: 15,   label: 'Large',       desc: 'Comfortable for tablet / small phone' },
  xl: { px: 17,   label: 'Extra Large', desc: 'Accessible — ideal for phone use' },
};

interface UiSettingsState {
  fontSize: FontSizeLevel;
  setFontSize: (level: FontSizeLevel) => void;
}

export const useUiSettingsStore = create<UiSettingsState>()(
  persist(
    (set) => ({
      fontSize: 'md',
      setFontSize: (fontSize) => set({ fontSize }),
    }),
    { name: 'insumitra-ui-settings' },
  ),
);
