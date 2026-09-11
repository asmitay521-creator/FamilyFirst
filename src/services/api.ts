export const api = {
  get: () => Promise.resolve({ data: { data: [] } }),
  post: () => Promise.resolve({ data: { data: {} } }),
  put: () => Promise.resolve({ data: { data: {} } }),
  patch: () => Promise.resolve({ data: { data: {} } }),
  delete: () => Promise.resolve({ data: { data: {} } }),
  interceptors: { request: { use: () => {} }, response: { use: () => {} } }
} as any;

export default api;
