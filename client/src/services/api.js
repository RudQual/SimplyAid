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

// Inventory & Boxes
export const getBoxes = (params) => API.get('/inventory/boxes', { params });
export const getBox = (id) => API.get(`/inventory/boxes/${id}`);
export const createBox = (data) => API.post('/inventory/boxes', data);
export const updateBox = (id, data) => API.put(`/inventory/boxes/${id}`, data);
export const inspectBox = (id, data) => API.put(`/inventory/boxes/${id}/inspect`, data);
export const replenishBox = (id, data) => API.put(`/inventory/boxes/${id}/replenish`, data);
export const getInventoryItems = () => API.get('/inventory/items');
export const generateBoxQr = (id) => API.post(`/inventory/boxes/${id}/generate-qr`);
export const scanBoxQr = (boxId) => API.get(`/inventory/boxes/scan/${boxId}`);
export const downloadBoxQr = (id) => API.get(`/inventory/boxes/${id}/download-qr`, { responseType: 'blob' });

// Reports
export const getAccidentRegister = (params) => API.get('/reports/accident-register', { params });
export const getDepartmentSummary = () => API.get('/reports/department-summary');
export const getComplianceStatus = () => API.get('/reports/compliance-status');

// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const markNotificationRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllRead = () => API.put('/notifications/read-all');
export const archiveNotification = (id) => API.put(`/notifications/${id}/archive`);
export const getNotificationStats = () => API.get('/notifications/stats');
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);
export const deleteBulkNotifications = (ids) => API.post('/notifications/delete-bulk', { ids });

// Prescriptions
export const consumePrescription = (id, data) => API.put(`/prescriptions/${id}/take`, data);

// Incident Workflow (Manager/Doctor)
export const managerConfirmIncident = (id, data) => API.put(`/incidents/${id}/manager-confirm`, data);
export const managerFillIncident = (id, data) => API.put(`/incidents/${id}/manager-fill`, data);
export const doctorReviewIncident = (id, data) => API.put(`/incidents/${id}/doctor-review`, data);

// Employee ID Card & Profile
export const getEmployeeProfile = (id) => API.get(`/employees/profile/${id}`);
export const updateEmployeeProfile = (id, data) => API.put(`/employees/profile/${id}`, data);
export const getEmployeeByQr = (employeeId) => API.get(`/employees/qr/${employeeId}`);
export const regenerateQr = (id) => API.post(`/employees/qr/${id}/regenerate`);
export const downloadQr = (id) => API.get(`/employees/qr/${id}/download`, { responseType: 'blob' });
export const uploadProfilePhoto = (id, formData) => API.put(`/employees/${id}/photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getEmployeeCardData = (id) => API.get(`/employees/card/${id}`);
export const getScanHistory = (params) => API.get('/employees/scan-history', { params });
export const getEmployeeScanHistory = (employeeId) => API.get(`/employees/scan-history/${employeeId}`);

// My Profile & QR Validation
export const getMyProfile = () => API.get('/employees/my-profile');
export const updateMyProfile = (data) => API.put('/employees/my-profile', data);
export const validateQrScan = (data) => API.post('/employees/qr/validate', data);
export const getMedicationOptions = () => API.get('/inventory/medication-options');

// --- Phase 2 APIs ---

// Treatments
export const getTreatments = (params) => API.get('/treatments', { params });
export const getTreatment = (id) => API.get(`/treatments/${id}`);
export const createTreatment = (data) => API.post('/treatments', data);
export const getTreatmentStats = (params) => API.get('/treatments/stats', { params });
export const getEmployeeTreatments = (employeeId) => API.get(`/treatments/employee/${employeeId}`);

// Medical Profiles
export const getMedicalProfile = (employeeId) => API.get(`/medical-profiles/${employeeId}`);
export const updateMedicalProfile = (employeeId, data) => API.put(`/medical-profiles/${employeeId}`, data);
export const getEmergencyCard = (employeeId) => API.get(`/medical-profiles/${employeeId}/emergency`);

// Prescriptions
export const getPrescriptions = (params) => API.get('/prescriptions', { params });
export const getPrescription = (id) => API.get(`/prescriptions/${id}`);
export const createPrescription = (data) => API.post('/prescriptions', data);
export const updatePrescription = (id, data) => API.put(`/prescriptions/${id}`, data);
export const getActivePrescriptions = (employeeId) => API.get(`/prescriptions/employee/${employeeId}/active`);

// Expiry Tracking
export const getExpiryDashboard = () => API.get('/expiry/dashboard');
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

// Analytics
export const getInjuryAnalytics = (params) => API.get('/analytics/injuries', { params });
export const getTreatmentAnalytics = (params) => API.get('/analytics/treatments', { params });
export const getInventoryAnalytics = (params) => API.get('/analytics/inventory', { params });
export const getComplianceAnalytics = () => API.get('/analytics/compliance');

// Audit Logs
export const getAuditLogs = (params) => API.get('/audit-logs', { params });

// Scanners
export const getScanners = () => API.get('/scanners');

export default API;
