# API Documentation

## Base URLs

- **Database API**: `http://localhost:8001`
- **Analysis API**: `http://localhost:8002`
- **Clustering API**: `http://localhost:8003`
- **Prediction API**: `http://localhost:8004`

## Database API

### Get Earthquakes List

**Endpoint**: `GET /api/earthquakes`

**Description**: Retrieve paginated list of earthquakes with optional filters

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 100, max: 1000): Items per page
- `start_date` (string, format: YYYY-MM-DD): Filter by start date
- `end_date` (string, format: YYYY-MM-DD): Filter by end date
- `min_magnitude` (float, 0-10): Minimum magnitude
- `max_magnitude` (float, 0-10): Maximum magnitude
- `min_depth` (float): Minimum depth in km
- `max_depth` (float): Maximum depth in km

**Example Request**:
```bash
curl "http://localhost:8001/api/earthquakes?page=1&limit=10&min_magnitude=5.0"
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "us7000kpuy",
      "time": "2024-01-15T10:30:00",
      "latitude": 35.5,
      "longitude": 140.2,
      "depth": 30.5,
      "magnitude": 6.2,
      "magnitude_type": "mw",
      "place": "Japan",
      "type": "earthquake",
      "status": "reviewed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1500,
    "pages": 150
  }
}
```

### Get Earthquake by ID

**Endpoint**: `GET /api/earthquakes/{id}`

**Description**: Retrieve detailed information for a specific earthquake

**Example Request**:
```bash
curl "http://localhost:8001/api/earthquakes/us7000kpuy"
```

### Get Statistics

**Endpoint**: `GET /api/earthquakes/stats`

**Description**: Get statistical summary of earthquakes

**Query Parameters**:
- `start_date` (string, optional): Filter start date
- `end_date` (string, optional): Filter end date

**Example Response**:
```json
{
  "total_count": 1500,
  "avg_magnitude": 4.5,
  "max_magnitude": 7.2,
  "min_magnitude": 2.5,
  "avg_depth": 45.3,
  "date_range_start": "2024-01-01T00:00:00",
  "date_range_end": "2024-01-31T23:59:59"
}
```

## Analysis API

### Get Time Series Analysis

**Endpoint**: `GET /api/analysis/timeseries`

**Description**: Analyze earthquake counts over time with resampling

**Query Parameters**:
- `period` (string, default: "daily"): Time period (daily, weekly, monthly)
- `start_date` (string, optional): Start date filter
- `end_date` (string, optional): End date filter

**Example Request**:
```bash
curl "http://localhost:8002/api/analysis/timeseries?period=weekly"
```

**Example Response**:
```json
{
  "period": "weekly",
  "data": [
    {
      "date": "2024-01-01",
      "count": 150,
      "avg_magnitude": 4.2,
      "max_magnitude": 6.5,
      "min_magnitude": 2.5,
      "std_magnitude": 0.8,
      "avg_depth": 35.5
    }
  ],
  "trend": {
    "slope": 0.5,
    "intercept": 100,
    "r_squared": 0.85,
    "trend_line": [100, 100.5, 101, ...]
  },
  "summary": {
    "total_earthquakes": 1500,
    "date_range": {
      "start": "2024-01-01",
      "end": "2024-01-31"
    },
    "overall_avg_magnitude": 4.5
  }
}
```

### Get Correlation Matrix

**Endpoint**: `GET /api/analysis/correlation`

**Description**: Calculate correlation between earthquake variables

**Example Request**:
```bash
curl "http://localhost:8002/api/analysis/correlation"
```

**Example Response**:
```json
{
  "variables": ["magnitude", "depth", "latitude", "longitude", "sig"],
  "correlation_matrix": {
    "magnitude": {
      "magnitude": 1.0,
      "depth": 0.15,
      "latitude": -0.05,
      "longitude": 0.02,
      "sig": 0.95
    }
  },
  "correlation_data": [
    {"x": "magnitude", "y": "depth", "value": 0.15}
  ]
}
```

### Get Seasonal Decomposition

**Endpoint**: `GET /api/analysis/seasonal`

**Description**: Decompose time series into trend, seasonal, and residual components

**Requirements**: Minimum 12 months of data

**Example Response**:
```json
{
  "data": [
    {
      "date": "2024-01-01",
      "observed": 150,
      "trend": 145,
      "seasonal": 5,
      "residual": 0
    }
  ],
  "period": 12,
  "model": "additive",
  "summary": {
    "seasonal_strength": 10.5,
    "trend_direction": "increasing"
  }
}
```

### Get Distribution

**Endpoint**: `GET /api/analysis/distribution`

**Description**: Get magnitude distribution histogram

**Query Parameters**:
- `bins` (integer, default: 20, range: 5-100): Number of histogram bins

**Example Response**:
```json
{
  "histogram": [
    {
      "bin_start": 2.5,
      "bin_end": 3.0,
      "bin_center": 2.75,
      "count": 250
    }
  ],
  "statistics": {
    "mean": 4.5,
    "median": 4.3,
    "std": 0.8,
    "min": 2.5,
    "max": 7.2,
    "q25": 3.8,
    "q75": 5.2
  }
}
```

## Clustering API

### Get Geographic Clusters

**Endpoint**: `GET /api/clusters/geographic`

**Description**: Cluster earthquakes by geographic location

**Query Parameters**:
- `algorithm` (string, default: "dbscan"): Algorithm (dbscan, kmeans)
- `n_clusters` (integer, default: 5): Number of clusters (kmeans only)
- `eps` (float, default: 5.0): DBSCAN epsilon parameter

**Example Request**:
```bash
curl "http://localhost:8003/api/clusters/geographic?algorithm=kmeans&n_clusters=5"
```

**Example Response**:
```json
{
  "algorithm": "kmeans",
  "parameters": {
    "n_clusters": 5
  },
  "clusters": [
    {
      "cluster_id": 0,
      "size": 250,
      "centroid": {
        "latitude": 35.5,
        "longitude": 140.2
      },
      "bounds": {
        "min_lat": 30.0,
        "max_lat": 40.0,
        "min_lon": 135.0,
        "max_lon": 145.0
      },
      "avg_magnitude": 4.5,
      "max_magnitude": 6.5,
      "avg_depth": 35.0
    }
  ],
  "data_points": [...],
  "summary": {
    "total_points": 1500,
    "n_clusters": 5
  }
}
```

### Get Magnitude Clusters

**Endpoint**: `GET /api/clusters/magnitude`

**Description**: Cluster earthquakes by magnitude and depth

**Query Parameters**:
- `n_clusters` (integer, default: 3): Number of clusters

**Example Response**:
```json
{
  "algorithm": "kmeans",
  "n_clusters": 3,
  "clusters": [
    {
      "cluster_id": 0,
      "size": 500,
      "centroid": {
        "magnitude": 4.0,
        "depth": 30.0
      },
      "statistics": {
        "avg_magnitude": 4.0,
        "std_magnitude": 0.5,
        "avg_depth": 30.0
      },
      "description": "Low magnitude, Shallow depth"
    }
  ]
}
```

### Get Risk Zones

**Endpoint**: `GET /api/clusters/risk-zones`

**Description**: Identify high-risk earthquake zones

**Example Response**:
```json
{
  "risk_zones": [
    {
      "zone_id": 0,
      "risk_level": "High",
      "risk_score": 150.5,
      "earthquake_count": 300,
      "avg_magnitude": 5.0,
      "max_magnitude": 7.0,
      "center": {
        "latitude": 35.5,
        "longitude": 140.2
      },
      "radius_km": 250.0
    }
  ],
  "summary": {
    "total_zones": 10,
    "high_risk_zones": 2,
    "medium_risk_zones": 5,
    "low_risk_zones": 3
  }
}
```

## Prediction API

### Get Forecast

**Endpoint**: `GET /api/predictions/forecast`

**Description**: Forecast earthquake counts for future days

**Query Parameters**:
- `days` (integer, default: 7, range: 1-30): Forecast period
- `model` (string, default: "prophet"): Model (prophet, arima)

**Example Request**:
```bash
curl "http://localhost:8004/api/predictions/forecast?days=7&model=prophet"
```

**Example Response**:
```json
{
  "model": "prophet",
  "forecast_days": 7,
  "historical_data": [...],
  "forecast": [
    {
      "date": "2024-02-01",
      "predicted_count": 45,
      "lower_bound": 30,
      "upper_bound": 60
    }
  ],
  "confidence_intervals": [...],
  "summary": {
    "avg_historical": 42.5,
    "avg_forecast": 45.2,
    "trend": "increasing"
  }
}
```

### Get Risk Forecast

**Endpoint**: `GET /api/predictions/risk-forecast`

**Description**: Forecast risk levels for future days

**Query Parameters**:
- `days` (integer, default: 7): Forecast period

**Example Response**:
```json
{
  "forecast_days": 7,
  "risk_forecast": [
    {
      "date": "2024-02-01",
      "predicted_count": 45,
      "risk_level": "Medium",
      "risk_score": 2,
      "confidence_range": {
        "lower": 30,
        "upper": 60
      }
    }
  ],
  "summary": {
    "high_risk_days": 1,
    "medium_risk_days": 4,
    "low_risk_days": 2
  }
}
```

### Get Magnitude Forecast

**Endpoint**: `GET /api/predictions/magnitude-forecast`

**Description**: Forecast average magnitude for future days

**Example Response**:
```json
{
  "forecast_days": 7,
  "magnitude_forecast": [
    {
      "date": "2024-02-01",
      "predicted_magnitude": 4.5,
      "lower_bound": 4.0,
      "upper_bound": 5.0
    }
  ],
  "summary": {
    "historical_avg_magnitude": 4.3,
    "forecast_avg_magnitude": 4.5
  }
}
```

## Error Responses

All APIs return errors in the following format:

```json
{
  "detail": "Error message description",
  "status_code": 400
}
```

**Common Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limiting

Currently no rate limiting is implemented. For production:
- Recommended: 100 requests/minute per IP
- Burst: 200 requests/minute

## Authentication

Currently no authentication is required. For production:
- JWT tokens recommended
- API keys for service-to-service communication

## Pagination

List endpoints support pagination:
- Default page size: 100
- Maximum page size: 1000
- Use `page` and `limit` parameters

## Caching

- Cache TTL: 5 minutes (300 seconds)
- Cache invalidation: Automatic on data updates
- Cache headers: `Cache-Control`, `ETag`
