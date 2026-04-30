import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
});

// 요청 인터셉터: Access Token 자동 삽입
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('chess-auth');
  if (stored) {
    const { state } = JSON.parse(stored);
    if (state?.accessToken) {
      config.headers.Authorization = `Bearer ${state.accessToken}`;
    }
  }
  return config;
});

// 응답 인터셉터: 토큰 만료 시 자동 갱신
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const stored = localStorage.getItem('chess-auth');
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.refreshToken) {
          try {
            const res = await api.post('/api/auth/refresh', { refreshToken: state.refreshToken });
            const { accessToken, refreshToken } = res.data;
            // 새 토큰 저장
            const newStored = JSON.parse(stored);
            newStored.state.accessToken = accessToken;
            newStored.state.refreshToken = refreshToken;
            localStorage.setItem('chess-auth', JSON.stringify(newStored));
            original.headers.Authorization = `Bearer ${accessToken}`;
            return api(original);
          } catch {
            localStorage.removeItem('chess-auth');
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
