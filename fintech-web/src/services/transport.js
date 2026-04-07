import api from './api';

export const transportService = {
  getVehicles: async (params = {}) => {
    const res = await api.get('/transport/vehicles/', { params });
    return res.data;
  },
  createVehicle: async (payload) => {
    const res = await api.post('/transport/vehicles/', payload);
    return res.data;
  },
  updateVehicle: async (id, payload) => {
    const res = await api.patch(`/transport/vehicles/${id}/`, payload);
    return res.data;
  },
  rotateTires: async (vehicleId, payload) => {
    const res = await api.post(`/transport/vehicles/${vehicleId}/rotate_tires/`, payload);
    return res.data;
  },
  setCurrentTires: async (vehicleId, payload) => {
    const res = await api.post(`/transport/vehicles/${vehicleId}/set-current-tires/`, payload);
    return res.data;
  },
  createRevenue: async (payload) => {
    const res = await api.post('/transport/revenues/', payload);
    return res.data;
  },
  createExpense: async (payload) => {
    const res = await api.post('/transport/expenses/', payload);
    return res.data;
  },
  updateRevenue: async (id, payload) => {
    const res = await api.patch(`/transport/revenues/${id}/`, payload);
    return res.data;
  },
  updateExpense: async (id, payload) => {
    const res = await api.patch(`/transport/expenses/${id}/`, payload);
    return res.data;
  },
  getRevenues: async (vehicleIdOrParams = {}) => {
    // aceita signature (vehicleId) ou (params)
    let params = {};
    if (vehicleIdOrParams && typeof vehicleIdOrParams === 'object') params = vehicleIdOrParams;
    else if (vehicleIdOrParams) params = { vehicle: vehicleIdOrParams };
    const res = await api.get('/transport/revenues/', { params });
    return res.data;
  },
  getExpenses: async (vehicleIdOrParams = {}) => {
    let params = {};
    if (vehicleIdOrParams && typeof vehicleIdOrParams === 'object') params = vehicleIdOrParams;
    else if (vehicleIdOrParams) params = { vehicle: vehicleIdOrParams };
    const res = await api.get('/transport/expenses/', { params });
    return res.data;
  },
  getVehicleSummary: async (id, start, end) => {
    let url = `/transport/vehicles/${id}/summary/`;
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const res = await api.get(url, { params });
    return res.data;
  },
  createTrip: async (payload) => {
    const res = await api.post('/transport/trips/', payload);
    return res.data;
  },
  getTrip: async (id) => {
    const res = await api.get(`/transport/trips/${id}/`);
    return res.data;
  },
  getTripMovements: async (id) => {
    const res = await api.get(`/transport/trips/${id}/movements/`);
    return res.data;
  },
  createTripMovement: async (id, payload) => {
    const res = await api.post(`/transport/trips/${id}/movements/`, payload);
    return res.data;
  },
  updateTripMovement: async (tripId, movementId, payload) => {
    const res = await api.patch(`/transport/trips/${tripId}/movements/${movementId}/`, payload);
    return res.data;
  },
  deleteTripMovement: async (tripId, movementId) => {
    const res = await api.delete(`/transport/trips/${tripId}/movements/${movementId}/`);
    return res.data;
  },
  updateTrip: async (id, payload) => {
    const res = await api.patch(`/transport/trips/${id}/`, payload);
    return res.data;
  },
  deleteTrip: async (id) => {
    const res = await api.delete(`/transport/trips/${id}/`);
    return res.data;
  },
  getTrips: async (params) => {
    const res = await api.get('/transport/trips/', { params });
    return res.data;
  },
  getTires: async (params = {}) => {
    const res = await api.get('/transport/tires/', { params });
    return res.data;
  },
  createTire: async (payload) => {
    const res = await api.post('/transport/tires/', payload);
    return res.data;
  },
  updateTire: async (id, payload) => {
    const res = await api.patch(`/transport/tires/${id}/`, payload);
    return res.data;
  },
  getTirePlacements: async (params = {}) => {
    const res = await api.get('/transport/tire-placements/', { params });
    return res.data;
  },
  getMaintenanceLogs: async (params = {}) => {
    const res = await api.get('/transport/maintenance-logs/', { params });
    return res.data;
  },
  createMaintenanceLog: async (payload) => {
    const res = await api.post('/transport/maintenance-logs/', payload);
    return res.data;
  },
  updateMaintenanceLog: async (id, payload) => {
    const res = await api.patch(`/transport/maintenance-logs/${id}/`, payload);
    return res.data;
  },
  getMaintenanceAlerts: async (params = {}) => {
    const res = await api.get('/transport/maintenance-alerts/', { params });
    return res.data;
  },
  markMaintenanceAlertRead: async (id) => {
    const res = await api.post(`/transport/maintenance-alerts/${id}/mark-read/`);
    return res.data;
  },
  deleteRevenue: async (id) => {
    const res = await api.delete(`/transport/revenues/${id}/`);
    return res.data;
  },
  deleteExpense: async (id) => {
    const res = await api.delete(`/transport/expenses/${id}/`);
    return res.data;
  },

  // Motoristas
  getDrivers: async (params = {}) => {
    const res = await api.get('/transport/drivers/', { params });
    return res.data;
  },
  createDriver: async (payload) => {
    const res = await api.post('/transport/drivers/', payload);
    return res.data;
  },
  updateDriver: async (id, payload) => {
    const res = await api.patch(`/transport/drivers/${id}/`, payload);
    return res.data;
  },
  deleteDriver: async (id) => {
    await api.delete(`/transport/drivers/${id}/`);
  },
};
