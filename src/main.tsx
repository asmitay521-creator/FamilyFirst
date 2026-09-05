import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { useUiSettingsStore, FONT_SIZE_MAP } from '@store/ui-settings.store';

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
        if (error?.code === 'ERR_NETWORK' || error?.message?.includes('ERR_NETWORK_CHANGED')) {
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
