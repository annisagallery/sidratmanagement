import axios from 'axios';
import { checkServer, isUnreachable, markServerUp } from './serverStatus';
import useAdminUserStore from 'src/stores/userStore';
import { attachPasswordConfirmation } from './confirmDelete';

const apiOrigin = String(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const baseURL = typeof window === 'undefined' ? `${apiOrigin}/api` : '/backend-api';

const http = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true
});

http.interceptors.response.use(
  (response) => {
    markServerUp();
    return response;
  },
  (error) => {
    // No answer from the API: a health check confirms it before the
    // "server unavailable" screen goes up (see services/serverStatus).
    if (isUnreachable(error)) checkServer();

    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const isLoginRequest = url.includes('/auth/adminlogin');

    if (status === 401 && !isLoginRequest && typeof window !== 'undefined') {
      useAdminUserStore.getState().logout();
      window.location.replace('/auth/login?reason=session-expired');
    }

    return Promise.reject(error);
  }
);

// Deletes are answered with 428 until the operator re-enters their password;
// this replays them transparently once confirmed.
attachPasswordConfirmation(http);

export default http;
