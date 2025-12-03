# Architecture Documentation

## System Overview

The Earthquake Analysis System follows a microservices architecture pattern, where each service is:
- **Independent**: Can be developed, deployed, and scaled independently
- **Containerized**: Runs in Docker containers
- **Loosely Coupled**: Services communicate via REST APIs
- **Specialized**: Each service has a specific responsibility

## Service Details

### 1. Data Ingestion Service

**Purpose**: Continuously fetch earthquake data from USGS API

**Technology**: Python 3.11, Requests, Schedule, psycopg2

**Key Features**:
- Scheduled fetching every 5 minutes
- Initial historical load (30 days)
- Incremental updates
- Data cleaning and validation
- Automatic retry on failures

**Data Flow**:
```
USGS API → Data Fetcher → Data Cleaner → PostgreSQL
```

**Configuration**:
- `FETCH_INTERVAL`: 300 seconds (5 minutes)
- `USGS_API_URL`: API endpoint
- `DATABASE_URL`: PostgreSQL connection string

### 2. Database API Service

**Purpose**: Provide RESTful API for earthquake data access

**Technology**: FastAPI, PostgreSQL, Redis, Pydantic

**Key Features**:
- CRUD operations
- Advanced filtering (date, magnitude, location)
- Pagination support
- Redis caching (5 min TTL)
- Query optimization
- Input validation

**Caching Strategy**:
- Cache key format: `earthquakes:page=X:limit=Y:filters...`
- TTL: 300 seconds
- Cache invalidation on updates

**Database Schema**:
```sql
earthquakes (
    id VARCHAR(100) PRIMARY KEY,
    time TIMESTAMP,
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    depth DECIMAL(10, 2),
    magnitude DECIMAL(4, 2),
    ...
)
```

### 3. Data Analysis Service

**Purpose**: Perform time-series analysis and statistical computations

**Technology**: FastAPI, Pandas, NumPy, SciPy, Statsmodels

**Analysis Types**:

1. **Time-Series Analysis**
   - Resampling: Daily → Weekly → Monthly
   - Aggregations: Count, Mean, Max, Min, Std
   - Trend calculation using linear regression

2. **Correlation Analysis**
   - Pearson correlation between variables
   - Heatmap-ready data format

3. **Seasonal Decomposition**
   - Additive model
   - Period: 12 months
   - Components: Trend, Seasonal, Residual

4. **Distribution Analysis**
   - Histogram generation
   - Statistical moments
   - Quantiles calculation

**Performance**:
- Vectorized operations with Pandas
- Efficient data loading
- Result caching

### 4. Clustering Service

**Purpose**: Identify patterns and groups in earthquake data

**Technology**: FastAPI, Scikit-learn, Pandas

**Algorithms**:

1. **DBSCAN** (Density-Based Spatial Clustering)
   - Parameters: eps=5.0, min_samples=5
   - Identifies noise points
   - No predefined cluster count

2. **K-Means**
   - User-defined cluster count
   - Centroid-based clustering
   - Standardized features

**Clustering Types**:

1. **Geographic Clustering**
   - Features: Latitude, Longitude
   - Use case: Seismic zone identification

2. **Magnitude-Depth Clustering**
   - Features: Magnitude, Depth (standardized)
   - Use case: Earthquake type classification

3. **Risk Zone Analysis**
   - Risk score = (frequency / 10) * avg_magnitude * (1 + max_magnitude / 10)
   - Categories: High, Medium, Low

### 5. Prediction Service

**Purpose**: Forecast future earthquake trends

**Technology**: FastAPI, Prophet, ARIMA, Statsmodels

**Models**:

1. **Prophet** (Facebook)
   - Additive regression model
   - Handles seasonality automatically
   - Daily & weekly seasonality enabled
   - 95% confidence intervals

2. **ARIMA** (AutoRegressive Integrated Moving Average)
   - Parameters: (1, 1, 1)
   - Classical time-series model
   - Approximate confidence intervals

**Prediction Types**:

1. **Count Forecast**
   - Predicts daily earthquake count
   - Historical comparison
   - Trend direction

2. **Risk Forecast**
   - Risk level categorization
   - Based on predicted counts
   - Risk scores: 1 (Low), 2 (Medium), 3 (High)

3. **Magnitude Forecast**
   - Average magnitude prediction
   - Confidence bounds
   - Comparison with historical average

### 6. Frontend Application

**Purpose**: Interactive data visualization dashboard

**Technology**: React 18, Vite, Ant Design, Recharts, Leaflet

**Architecture Pattern**: Component-Based

**Key Components**:

1. **TimeSeriesChart**
   - Dual Y-axis (count & magnitude)
   - Trend line overlay
   - Period selection (daily/weekly/monthly)

2. **ScatterPlot**
   - Magnitude vs Time
   - Depth color coding
   - Clustering visualization

3. **HistogramChart**
   - Magnitude distribution
   - Configurable bins
   - Frequency analysis

4. **CorrelationHeatmap**
   - Color-coded correlation values
   - Interactive hover
   - Legend for interpretation

5. **SeasonalChart**
   - Three-panel layout
   - Observed + Trend
   - Seasonal component
   - Residual

6. **PredictionChart**
   - Forecast visualization
   - Confidence intervals (area chart)
   - Model selection
   - Multiple forecast types

7. **ClusterMap**
   - Interactive Leaflet map
   - Cluster markers
   - Centroid visualization
   - Algorithm selection

**State Management**:
- React hooks (useState, useEffect)
- Component-level state
- API data fetching

**Performance Optimizations**:
- Lazy loading
- Memoization
- Debounced API calls
- Responsive design

## Data Flow Architecture

### Real-time Data Pipeline

```
1. USGS API
   ↓
2. Data Ingestion Service
   ↓ (Every 5 minutes)
3. PostgreSQL Database
   ↓ (On demand)
4. Backend Services (Analysis, Clustering, Prediction)
   ↓ (REST API)
5. Frontend Dashboard
   ↓
6. User Browser
```

### Request Flow

```
User Action (Frontend)
   ↓
API Request (Axios)
   ↓
Backend Service (FastAPI)
   ↓
Check Redis Cache
   ├─ Hit → Return cached data
   └─ Miss → Query PostgreSQL
      ↓
   Process Data
      ↓
   Cache Result (Redis)
      ↓
   Return Response
```

## Database Design

### Indexes
- `idx_earthquakes_time`: For time-range queries
- `idx_earthquakes_magnitude`: For magnitude filtering
- `idx_earthquakes_location`: Composite index for geographic queries

### Relationships
- One-to-many: Earthquakes → Analysis Results
- One-to-many: Earthquakes → Clusters
- One-to-many: Date → Predictions

## Security Considerations

1. **API Security**
   - CORS configuration
   - Input validation (Pydantic)
   - SQL injection prevention (parameterized queries)

2. **Data Validation**
   - Type checking
   - Range validation
   - Required field enforcement

3. **Rate Limiting** (Future Enhancement)
   - Request throttling
   - IP-based limits

## Scalability

### Horizontal Scaling
- Each service can be replicated
- Load balancer distribution
- Stateless service design

### Vertical Scaling
- Increase container resources
- Database optimization
- Redis memory allocation

### Database Optimization
- Connection pooling
- Query optimization
- Indexed columns
- Materialized views (future)

## Monitoring & Logging

### Logging Strategy
- Structured logging
- Log levels: INFO, WARNING, ERROR
- Service-specific logs

### Metrics to Monitor
- API response times
- Database query performance
- Cache hit rates
- Service health status
- Error rates

## Deployment

### Docker Compose
- Multi-container orchestration
- Network isolation
- Volume persistence
- Health checks
- Restart policies

### Cloud Deployment (Future)
- Kubernetes orchestration
- Auto-scaling policies
- Load balancing
- Service mesh (Istio)

## API Design Principles

1. **RESTful**: Standard HTTP methods
2. **Versioned**: Future-proof API versions
3. **Consistent**: Uniform response format
4. **Documented**: OpenAPI/Swagger specs
5. **Paginated**: Efficient data transfer
6. **Filtered**: Flexible query parameters

## Error Handling

### Error Response Format
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

### HTTP Status Codes
- 200: Success
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

## Future Enhancements

1. **Authentication & Authorization**
   - JWT tokens
   - Role-based access control

2. **WebSocket Support**
   - Real-time updates
   - Push notifications

3. **Advanced ML Models**
   - LSTM networks
   - Ensemble methods

4. **Data Export**
   - CSV/JSON download
   - Report generation

5. **Alert System**
   - Email notifications
   - Threshold-based alerts

6. **Mobile App**
   - React Native
   - Push notifications

## Technology Choices Rationale

### Why Python?
- Rich data science ecosystem
- Fast development
- Strong ML/AI libraries

### Why FastAPI?
- High performance (async)
- Auto documentation
- Type validation
- Modern Python features

### Why PostgreSQL?
- ACID compliance
- JSON support
- Geospatial extensions (PostGIS)
- Robust and mature

### Why Redis?
- In-memory speed
- Simple key-value store
- TTL support
- Pub/sub capabilities

### Why React?
- Component reusability
- Virtual DOM performance
- Large ecosystem
- Easy learning curve

## Conclusion

This architecture provides:
- **Modularity**: Easy to modify individual services
- **Scalability**: Can handle increased load
- **Maintainability**: Clear separation of concerns
- **Reliability**: Fault isolation between services
- **Performance**: Caching and optimization strategies
