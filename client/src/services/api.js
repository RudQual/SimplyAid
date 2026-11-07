import axios from 'axios';

const TOKEN_KEY = 'simplyaid_token';
const USER_KEY = 'simplyaid_user';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 30000 });

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
};

API.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Session expired / revoked → back to sign-in (but never for the sign-in calls themselves).
API.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || '';
    const isAuthCall = /\/auth\/(login|signup|quick-login|change-password)/.test(url);
    if (error.response?.status === 401 && !isAuthCall && tokenStore.get()) {
      tokenStore.clear();
      if (!window.location.pathname.startsWith('/login')) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?expired=1&next=${next}`);
      }
    }
    return Promise.reject(error);
  }
);

// Blob downloads: turn JSON error bodies back into readable errors
const download = async (url, params) => {
  try {
    return await API.get(url, { params, responseType: 'blob' });
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      try { err.response.data = JSON.parse(await err.response.data.text()); } catch { /* not JSON */ }
    }
    throw err;
  }
};

// Auth
export const getAuthConfig = () => API.get('/auth/config');
export const loginUser = (data) => API.post('/auth/login', data);
export const logoutUser = () => API.post('/auth/logout');
export const getMe = () => API.get('/auth/me');
export const registerUser = (data) => API.post('/users', data);
export const signupUser = (data) => API.post('/auth/signup', data);
export const changePassword = (data) => API.put('/auth/change-password', data);
export const quickLoginUser = (data) => API.post('/auth/quick-login', data);
export const getDemoAccountsList = () => API.get('/auth/demo-accounts');

// Dashboard
export const getDashboard = () => API.get('/dashboard');

// Users
export const getUsers = (params) => API.get('/users', { params });
export const getUser = (id) => API.get(`/users/${id}`);
export const createUser = (data) => API.post('/users', data);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const setUserStatus = (id, isActive) => API.patch(`/users/${id}/status`, { isActive });
export const resetUserPassword = (id, newPassword) => API.post(`/users/${id}/reset-password`, { newPassword });
export const deleteUser = (id) => API.delete(`/users/${id}`);
export const getExpiringCerts = (days) => API.get('/users/expiring-certifications', { params: { days } });

// Companies
export const getCompanies = () => API.get('/companies');
export const getCompany = (id) => API.get(`/companies/${id}`);
export const updateCompany = (id, data) => API.put(`/companies/${id}`, data);

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
export const triggerSOS = () => API.post('/incidents/sos');
export const downloadForm18 = (id) => download(`/incidents/${id}/form18`);
export const managerConfirmIncident = (id, data) => API.put(`/incidents/${id}/manager-confirm`, data);
export const managerFillIncident = (id, data) => API.put(`/incidents/${id}/manager-fill`, data);
export const doctorReviewIncident = (id, data) => API.put(`/incidents/${id}/doctor-review`, data);

// Inventory catalog
export const getInventoryItems = (params) => API.get('/inventory/items', { params });
export const getInventoryItem = (id) => API.get(`/inventory/items/${id}`);
export const createInventoryItem = (data) => API.post('/inventory/items', data);
export const updateInventoryItem = (id, data) => API.put(`/inventory/items/${id}`, data);
export const deleteInventoryItem = (id) => API.delete(`/inventory/items/${id}`);
export const getInventorySummary = () => API.get('/inventory/summary');
export const getStockTransactions = (params) => API.get('/inventory/transactions', { params });
export const getMedicationOptions = () => API.get('/inventory/medication-options');

// Kits (first aid boxes)
export const getBoxes = (params) => API.get('/inventory/boxes', { params });
export const getBox = (id) => API.get(`/inventory/boxes/${id}`);
export const createBox = (data) => API.post('/inventory/boxes', data);
export const updateBox = (id, data) => API.put(`/inventory/boxes/${id}`, data);
export const retireBox = (id, reason) => API.delete(`/inventory/boxes/${id}`, { data: { reason } });
export const inspectBox = (id, data) => API.put(`/inventory/boxes/${id}/inspect`, data);
export const replenishBox = (id, data) => API.put(`/inventory/boxes/${id}/replenish`, data);
export const addBoxItem = (id, data) => API.post(`/inventory/boxes/${id}/items`, data);
export const updateBoxItem = (id, itemId, data) => API.put(`/inventory/boxes/${id}/items/${itemId}`, data);
export const removeBoxItem = (id, itemId, reason) => API.delete(`/inventory/boxes/${id}/items/${itemId}`, { data: { reason } });
export const restockBoxItem = (id, itemId, data) => API.post(`/inventory/boxes/${id}/items/${itemId}/restock`, data);
export const dispenseBoxItem = (id, itemId, data) => API.post(`/inventory/boxes/${id}/items/${itemId}/dispense`, data);
export const adjustBoxItem = (id, itemId, data) => API.post(`/inventory/boxes/${id}/items/${itemId}/adjust`, data);
export const removeExpiredStock = (id, itemId) => API.post(itemId ? `/inventory/boxes/${id}/items/${itemId}/remove-expired` : `/inventory/boxes/${id}/remove-expired`, {});
export const updateBoxItemStocks = (boxId, itemId, data) => API.put(`/inventory/boxes/${boxId}/items/${itemId}/stocks`, data);
export const generateBoxQr = (id) => API.post(`/inventory/boxes/${id}/generate-qr`);
export const scanBoxQr = (boxId) => API.get(`/inventory/boxes/scan/${encodeURIComponent(boxId)}`);
export const downloadBoxQr = (id) => download(`/inventory/boxes/${id}/download-qr`);

// Reports
export const listReports = () => API.get('/reports');
export const getReport = (type, params) => API.get(`/reports/${type}`, { params });
export const exportReport = (type, format, params) => download(`/reports/${type}`, { ...params, format });
export const getAccidentRegister = (params) => API.get('/reports/accident-register', { params });
export const getDepartmentSummary = () => API.get('/reports/department-summary');
export const getComplianceStatus = () => API.get('/reports/compliance-status');

// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const markNotificationRead = (id, isRead = true) => API.put(`/notifications/${id}/read`, { isRead });
export const markAllRead = () => API.put('/notifications/read-all');
export const markBulkRead = (ids) => API.post('/notifications/read-bulk', { ids });
export const archiveNotification = (id, archived = true) => API.put(`/notifications/${id}/archive`, { archived });
export const getNotificationStats = () => API.get('/notifications/stats');
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);
export const deleteBulkNotifications = (ids) => API.post('/notifications/delete-bulk', { ids });

// Employee ID card & profile
export const getEmployeeProfile = (id) => API.get(`/employees/profile/${id}`);
export const updateEmployeeProfile = (id, data) => API.put(`/employees/profile/${id}`, data);
export const getEmployeeByQr = (employeeId) => API.get(`/employees/qr/${encodeURIComponent(employeeId)}`);
export const regenerateQr = (id) => API.post(`/employees/qr/${id}/regenerate`);
export const downloadQr = (id) => download(`/employees/qr/${id}/download`);
export const uploadProfilePhoto = (id, formData) => API.put(`/employees/${id}/photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getEmployeeCardData = (id) => API.get(`/employees/card/${id}`);
export const getScanHistory = (params) => API.get('/employees/scan-history', { params });
export const getEmployeeScanHistory = (employeeId) => API.get(`/employees/scan-history/${employeeId}`);
export const getMyProfile = () => API.get('/employees/my-profile');
export const updateMyProfile = (data) => API.put('/employees/my-profile', data);
export const validateQrScan = (data) => API.post('/employees/qr/validate', data);

// Treatments
export const getTreatments = (params) => API.get('/treatments', { params });
export const getTreatment = (id) => API.get(`/treatments/${id}`);
export const createTreatment = (data) => API.post('/treatments', data);
export const getTreatmentStats = (params) => API.get('/treatments/stats', { params });
export const getEmployeeTreatments = (employeeId) => API.get(`/treatments/employee/${employeeId}`);

// Medical profiles
export const getMedicalProfile = (employeeId) => API.get(`/medical-profiles/${employeeId}`);
export const updateMedicalProfile = (employeeId, data) => API.put(`/medical-profiles/${employeeId}`, data);
export const getEmergencyCard = (employeeId) => API.get(`/medical-profiles/${employeeId}/emergency`);

// Expiry
export const getExpiryDashboard = (params) => API.get('/expiry/dashboard', { params });
export const getExpiringItems = (params) => API.get('/expiry/items', { params });
export const checkExpiryAlerts = () => API.post('/expiry/check-alerts');

// Compliance
export const getCompanyCompliance = () => API.get('/compliance/company');
export const getDepartmentCompliance = () => API.get('/compliance/departments');
export const runComplianceCheck = () => API.post('/compliance/check');

// Inspections
export const getInspections = (params) => API.get('/inspections', { params });
export const getInspection = (id) => API.get(`/inspections/${id}`);
export const createInspection = (data) => API.post('/inspections', data);
export const resolveDeficiency = (id, defId) => API.put(`/inspections/${id}/deficiencies/${defId}/resolve`);

// Analytics
export const getInjuryAnalytics = (params) => API.get('/analytics/injuries', { params });
export const getTreatmentAnalytics = (params) => API.get('/analytics/treatments', { params });
export const getInventoryAnalytics = (params) => API.get('/analytics/inventory', { params });
export const getComplianceAnalytics = () => API.get('/analytics/compliance');

// Activity log
export const getAuditLogs = (params) => API.get('/audit-logs', { params });

// Scanners
export const getScanners = () => API.get('/scanners');

export default API;
