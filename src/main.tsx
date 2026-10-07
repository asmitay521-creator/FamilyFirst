import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { useUiSettingsStore, FONT_SIZE_MAP } from '@store/ui-settings.store';

// One-time cleanup of old local storage data to sync with Firestore wipe
try {
  const RESET_VERSION_KEY = 'familyfirst_cleaned_data_v1';
  if (!localStorage.getItem(RESET_VERSION_KEY)) {
    const keysToRemove = [
      'insumitra_local_contacts',
      'insumitra_custom_policies',
      'insumitra_custom_leads',
      'insumitra_custom_claims',
      'insumitra_custom_employees',
      'insumitra_seminars_data',
      'insumitra_local_leads',
      'insumitra_website_leads',
      'rahul_kulkarni_leads',
      'rahul_kulkarni_checkups',
      'insumitra_contacts',
      'policy_badges_hidden',
      'insumitra_deleted_lead_keys',
      'insumitra_seminar_settings',
      'mock_dropdowns'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    localStorage.setItem(RESET_VERSION_KEY, 'true');
  }
} catch (e) {}

/** Applies --app-font-size on <html> whenever the stored level changes. */
function FontSizeApplier() {
  const fontSize = useUiSettingsStore(s => s.fontSize);
  useEffect(() => {
    const px = FONT_SIZE_MAP[fontSize]?.px ?? 13.5;
    document.documentElement.style.setProperty('--app-font-size', `${px}px`);
  }, [fontSize]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (
          error?.response?.status === 401 ||
          error?.status === 401 ||
          error?.code === 'ERR_NETWORK' ||
          error?.message?.includes('ERR_NETWORK_CHANGED')
        ) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <FontSizeApplier />
        <App />
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
