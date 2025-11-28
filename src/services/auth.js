import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/auth'
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const signup = async ({ name, email, password }) => {
  try {
    console.log('Attempting signup for:', email);
    const { data } = await apiClient.post('/signup/', { name, email, password });
    console.log('Signup successful:', data);
    return data;
  } catch (error) {
    console.error('Signup error:', error.response?.data || error.message);
    throw error;
  }
};

export const login = async ({ email, password }) => {
  try {
    console.log('Attempting login for:', email);
    const { data } = await apiClient.post('/login/', { email, password });
    console.log('Login successful:', data);
    return data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error;
  }
};

export const getProfile = async () => {
  const { data } = await apiClient.get('/me/');
  return data;
};
