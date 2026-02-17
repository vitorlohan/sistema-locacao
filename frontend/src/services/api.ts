import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api' });

/* ── Inject token ── */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* ── Refresh on 401 ── */
/* Separate instance for refresh (no interceptors = no infinite loop) */
const refreshApi = axios.create({ baseURL: '/api' });

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const orig = error.config;

    // Licença inválida — redireciona para ativação
    if (
      error.response?.status === 403 &&
      error.response?.data?.licensed === false
    ) {
      if (!window.location.pathname.startsWith('/ativar')) {
        window.location.href = '/ativar';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      try {
        if (!refreshing) {
          refreshing = refreshApi
            .post('/auth/refresh', { refresh_token: refreshToken })
            .then((r) => {
              const t = r.data.token as string;
              localStorage.setItem('token', t);
              return t;
            })
            .finally(() => { refreshing = null; });
        }
        const newToken = await refreshing;
        orig.headers.Authorization = `Bearer ${newToken}`;
        return api(orig);
      } catch {
        logout();
        return Promise.reject(error);
      }
    }
    /* Generic error toast */
    const msg = error.response?.data?.message || error.message;
    if (error.response?.status !== 401) toast.error(msg);
    return Promise.reject(error);
  },
);

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export default api;
