import axiosClient from './axiosClient';

export async function login({ email, password }) {
  try {
    const res = await axiosClient.post('/auth/login', { email, password });
    const { accessToken, user } = res.data.data;
    sessionStorage.setItem('laetus_token', accessToken);
    localStorage.setItem('laetus_token', accessToken);
    return { accessToken, user };
  } catch (err) {
    // Surface the backend's { success:false, message } shape as a plain Error
    // message so the Login page's existing catch block keeps working unchanged.
    throw { message: err?.response?.data?.message || 'Unable to sign in. Please check your connection and try again.' };
  }
}

export function logout() {
  sessionStorage.removeItem('laetus_token');
  localStorage.removeItem('laetus_token');
}
