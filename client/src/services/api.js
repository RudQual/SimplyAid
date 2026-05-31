import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('simplyaid_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('simplyaid_token');
      localStorage.removeItem('simplyaid_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = (data) => API.post('/auth/login', data);
export const getMe = () => API.get('/auth/me');
export const registerUser = (data) => API.post('/auth/register', data);
export const signupUser = (data) => API.post('/auth/signup', data);
export const changePassword = (data) => API.put('/auth/change-password', data);

// Users
export const getUsers = (params) => API.get('/users', { params });
export const getUser = (id) => API.get(`/users/${id}`);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);
export const getExpiringCerts = (days) => API.get('/users/expiring-certifications', { params: { days } });

// Companies
export const getCompanies = () => API.get('/companies');
export const createCompany = (data) => API.post('/companies', data);

// Departments
export const getDepartments = () => API.get('/departments');
export const createDepartment = (data) => API.post('/departments', data);
export const updateDepartment = (id, data) => API.put(`/departments/${id}`, data);
export const deleteDepartment = (id) => API.delete(`/departments/${id}`);

// Incidents
export const getIncidents = (params) => API.get('/incidents', { params });
export const getIncident = (id) => API.get(`/incidents/${id}`);
export const createIncident = (data) => API.post('/incidents', data);
export const updateIncident = (id, data) => API.put(`/incidents/${id}`, data);
export const getIncidentStats = (params) => API.get('/incidents/stats/summary', { params });

// Inventory
export const getBoxes = (params) => API.get('/inventory/boxes', { params });
export const getBox = (id) => API.get(`/inventory/boxes/${id}`);
export const createBox = (data) => API.post('/inventory/boxes', data);
export const updateBox = (id, data) => API.put(`/inventory/boxes/${id}`, data);
export const inspectBox = (id, data) => API.put(`/inventory/boxes/${id}/inspect`, data);
export const replenishBox = (id, data) => API.put(`/inventory/boxes/${id}/replenish`, data);
export const getInventoryItems = () => API.get('/inventory/items');

// Reports
export const getAccidentRegister = (params) => API.get('/reports/accident-register', { params });
export const getDepartmentSummary = () => API.get('/reports/department-summary');
export const getComplianceStatus = () => API.get('/reports/compliance-status');

// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllRead = () => API.put('/notifications/read-all');

// Prescriptions
export const getPrescriptions = () => API.get('/prescriptions');
export const createPrescription = (data) => API.post('/prescriptions', data);
export const consumePrescription = (id, data) => API.put(`/prescriptions/${id}/take`, data);

// Vending Machine
export const vendingLogin = (data) => API.post('/vending/login', data);
export const vendingDispense = (data) => API.post('/vending/dispense', data);

export default API;
