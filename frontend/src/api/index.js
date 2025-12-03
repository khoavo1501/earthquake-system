import axios from 'axios';

// Lấy API_HOST từ biến môi trường hoặc tự động detect từ URL
const getApiHost = () => {
  // Ưu tiên lấy từ biến môi trường
  if (import.meta.env.VITE_API_HOST) {
    return import.meta.env.VITE_API_HOST;
  }
  // Fallback: dùng hostname hiện tại
  return window.location.hostname;
};

const API_HOST = getApiHost();

// Các URL API - chỉ cần thay đổi API_HOST trong file .env
const DATABASE_API_URL = `http://${API_HOST}:8001`;
const ANALYSIS_API_URL = `http://${API_HOST}:8002`;
const CLUSTERING_API_URL = `http://${API_HOST}:8003`;
const PREDICTION_API_URL = `http://${API_HOST}:8004`;

// Database API
export const databaseAPI = {
  getEarthquakes: (params) => axios.get(`${DATABASE_API_URL}/api/earthquakes`, { params }),
  getEarthquake: (id) => axios.get(`${DATABASE_API_URL}/api/earthquakes/${id}`),
  getStats: (params) => axios.get(`${DATABASE_API_URL}/api/earthquakes/stats`, { params }),
  getLatest: (limit = 10) => axios.get(`${DATABASE_API_URL}/api/earthquakes`, { 
    params: { 
      limit, 
      sort_by: 'time', 
      sort_order: 'desc' 
    } 
  }),
};

// Analysis API
export const analysisAPI = {
  getTimeseries: (params) => axios.get(`${ANALYSIS_API_URL}/api/analysis/timeseries`, { params }),
  getCorrelation: (params) => axios.get(`${ANALYSIS_API_URL}/api/analysis/correlation`, { params }),
  getSeasonal: (params) => axios.get(`${ANALYSIS_API_URL}/api/analysis/seasonal`, { params }),
  getDistribution: (params) => axios.get(`${ANALYSIS_API_URL}/api/analysis/distribution`, { params }),
};

// Clustering API
export const clusteringAPI = {
  getGeographicClusters: (params) => axios.get(`${CLUSTERING_API_URL}/api/clusters/geographic`, { params }),
  getMagnitudeClusters: (params) => axios.get(`${CLUSTERING_API_URL}/api/clusters/magnitude`, { params }),
  getRiskZones: (params) => axios.get(`${CLUSTERING_API_URL}/api/clusters/risk-zones`, { params }),
};

// Prediction API
export const predictionAPI = {
  getForecast: (params) => axios.get(`${PREDICTION_API_URL}/api/predictions/forecast`, { params }),
  getRiskForecast: (params) => axios.get(`${PREDICTION_API_URL}/api/predictions/risk-forecast`, { params }),
  getMagnitudeForecast: (params) => axios.get(`${PREDICTION_API_URL}/api/predictions/magnitude-forecast`, { params }),
  getLatest: () => axios.get(`${PREDICTION_API_URL}/api/predictions/latest`),
};
