import axios from 'axios';

const DATABASE_API_URL = import.meta.env.VITE_DATABASE_API_URL || 'http://localhost:8001';
const ANALYSIS_API_URL = import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8002';
const CLUSTERING_API_URL = import.meta.env.VITE_CLUSTERING_API_URL || 'http://localhost:8003';
const PREDICTION_API_URL = import.meta.env.VITE_PREDICTION_API_URL || 'http://localhost:8004';

// Database API
export const databaseAPI = {
  getEarthquakes: (params) => axios.get(`${DATABASE_API_URL}/api/earthquakes`, { params }),
  getEarthquake: (id) => axios.get(`${DATABASE_API_URL}/api/earthquakes/${id}`),
  getStats: (params) => axios.get(`${DATABASE_API_URL}/api/earthquakes/stats`, { params }),
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
