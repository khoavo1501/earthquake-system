-- Initialize Database Schema for Earthquake System

CREATE TABLE IF NOT EXISTS earthquakes (
    id VARCHAR(100) PRIMARY KEY,
    time TIMESTAMP NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    depth DECIMAL(10, 2),
    magnitude DECIMAL(4, 2),
    magnitude_type VARCHAR(10),
    place TEXT,
    type VARCHAR(50),
    status VARCHAR(50),
    tsunami INTEGER,
    sig INTEGER,
    net VARCHAR(10),
    code VARCHAR(50),
    nst INTEGER,
    dmin DECIMAL(10, 6),
    rms DECIMAL(10, 6),
    gap DECIMAL(10, 2),
    updated TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_earthquakes_time ON earthquakes(time);
CREATE INDEX idx_earthquakes_magnitude ON earthquakes(magnitude);
CREATE INDEX idx_earthquakes_location ON earthquakes(latitude, longitude);

CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    analysis_type VARCHAR(50) NOT NULL,
    period VARCHAR(20),
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_results_type ON analysis_results(analysis_type);
CREATE INDEX idx_analysis_results_created ON analysis_results(created_at);

CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    cluster_type VARCHAR(50) NOT NULL,
    cluster_label INTEGER NOT NULL,
    centroid JSONB,
    earthquake_ids TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clusters_type ON clusters(cluster_type);

CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    prediction_date DATE NOT NULL,
    forecast_data JSONB NOT NULL,
    model_used VARCHAR(50),
    confidence_interval JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_predictions_date ON predictions(prediction_date);
CREATE INDEX idx_predictions_created ON predictions(created_at);
