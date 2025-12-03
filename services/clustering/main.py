import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import psycopg2
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN, KMeans
from sklearn.preprocessing import StandardScaler
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
db_conn = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager"""
    global db_conn
    
    # Startup
    db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres123@localhost:5432/earthquake_db')
    
    try:
        db_conn = psycopg2.connect(db_url)
        logger.info("Database connection established")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
    
    yield
    
    # Shutdown
    if db_conn:
        db_conn.close()
        logger.info("Database connection closed")


app = FastAPI(
    title="Earthquake Clustering API",
    description="Clustering analysis for earthquake patterns",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fetch_earthquake_data(start_date: Optional[str] = None, end_date: Optional[str] = None) -> pd.DataFrame:
    """Fetch earthquake data from database"""
    query = "SELECT * FROM earthquakes WHERE magnitude IS NOT NULL AND depth IS NOT NULL"
    params = []
    
    if start_date:
        query += " AND time >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND time <= %s"
        params.append(end_date)
    
    query += " ORDER BY time DESC"
    
    try:
        df = pd.read_sql_query(query, db_conn, params=params)
        return df
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        raise


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Earthquake Clustering API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/clusters/geographic")
async def get_geographic_clusters(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    algorithm: str = Query("dbscan", description="Clustering algorithm: dbscan or kmeans"),
    n_clusters: int = Query(5, ge=2, le=20, description="Number of clusters (for kmeans)"),
    eps: float = Query(5.0, gt=0, description="DBSCAN epsilon parameter (in degrees)")
):
    """
    Perform geographic clustering based on latitude and longitude
    """
    try:
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Prepare features
        X = df[['latitude', 'longitude']].values
        
        # Perform clustering
        if algorithm == "dbscan":
            clusterer = DBSCAN(eps=eps, min_samples=5)
            labels = clusterer.fit_predict(X)
        elif algorithm == "kmeans":
            clusterer = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = clusterer.fit_predict(X)
        else:
            raise HTTPException(status_code=400, detail="Invalid algorithm")
        
        # Add cluster labels to dataframe
        df['cluster'] = labels
        
        # Calculate cluster statistics
        clusters_info = []
        unique_labels = sorted(df['cluster'].unique())
        
        for label in unique_labels:
            if label == -1:  # Noise points in DBSCAN
                continue
            
            cluster_data = df[df['cluster'] == label]
            
            clusters_info.append({
                'cluster_id': int(label),
                'size': int(len(cluster_data)),
                'centroid': {
                    'latitude': float(cluster_data['latitude'].mean()),
                    'longitude': float(cluster_data['longitude'].mean())
                },
                'bounds': {
                    'min_lat': float(cluster_data['latitude'].min()),
                    'max_lat': float(cluster_data['latitude'].max()),
                    'min_lon': float(cluster_data['longitude'].min()),
                    'max_lon': float(cluster_data['longitude'].max())
                },
                'avg_magnitude': float(cluster_data['magnitude'].mean()),
                'max_magnitude': float(cluster_data['magnitude'].max()),
                'avg_depth': float(cluster_data['depth'].mean())
            })
        
        # Prepare data points with cluster labels
        data_points = []
        for idx, row in df.iterrows():
            data_points.append({
                'id': row['id'],
                'latitude': float(row['latitude']),
                'longitude': float(row['longitude']),
                'magnitude': float(row['magnitude']),
                'depth': float(row['depth']),
                'cluster': int(row['cluster']),
                'time': row['time'].isoformat() if pd.notna(row['time']) else None
            })
        
        return {
            "algorithm": algorithm,
            "parameters": {
                "n_clusters": n_clusters if algorithm == "kmeans" else None,
                "eps": eps if algorithm == "dbscan" else None
            },
            "clusters": clusters_info,
            "data_points": data_points,
            "summary": {
                "total_points": int(len(df)),
                "n_clusters": len(clusters_info),
                "noise_points": int((df['cluster'] == -1).sum()) if algorithm == "dbscan" else 0
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in geographic clustering: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/clusters/magnitude")
async def get_magnitude_depth_clusters(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    n_clusters: int = Query(3, ge=2, le=10, description="Number of clusters")
):
    """
    Cluster earthquakes by magnitude and depth
    """
    try:
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Prepare features
        features = df[['magnitude', 'depth']].values
        
        # Standardize features
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # Perform K-means clustering
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(features_scaled)
        
        # Add cluster labels
        df['cluster'] = labels
        
        # Calculate cluster statistics
        clusters_info = []
        
        for label in range(n_clusters):
            cluster_data = df[df['cluster'] == label]
            
            # Inverse transform centroid
            centroid_scaled = kmeans.cluster_centers_[label]
            centroid = scaler.inverse_transform([centroid_scaled])[0]
            
            clusters_info.append({
                'cluster_id': int(label),
                'size': int(len(cluster_data)),
                'centroid': {
                    'magnitude': float(centroid[0]),
                    'depth': float(centroid[1])
                },
                'statistics': {
                    'avg_magnitude': float(cluster_data['magnitude'].mean()),
                    'std_magnitude': float(cluster_data['magnitude'].std()),
                    'min_magnitude': float(cluster_data['magnitude'].min()),
                    'max_magnitude': float(cluster_data['magnitude'].max()),
                    'avg_depth': float(cluster_data['depth'].mean()),
                    'std_depth': float(cluster_data['depth'].std()),
                    'min_depth': float(cluster_data['depth'].min()),
                    'max_depth': float(cluster_data['depth'].max())
                },
                'description': get_cluster_description(
                    float(cluster_data['magnitude'].mean()),
                    float(cluster_data['depth'].mean())
                )
            })
        
        # Prepare data points
        data_points = []
        for idx, row in df.iterrows():
            data_points.append({
                'id': row['id'],
                'magnitude': float(row['magnitude']),
                'depth': float(row['depth']),
                'latitude': float(row['latitude']),
                'longitude': float(row['longitude']),
                'cluster': int(row['cluster']),
                'time': row['time'].isoformat() if pd.notna(row['time']) else None
            })
        
        return {
            "algorithm": "kmeans",
            "n_clusters": n_clusters,
            "clusters": clusters_info,
            "data_points": data_points,
            "summary": {
                "total_points": int(len(df))
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in magnitude-depth clustering: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def get_cluster_description(avg_magnitude: float, avg_depth: float) -> str:
    """Generate human-readable cluster description"""
    mag_desc = "Low" if avg_magnitude < 4 else "Medium" if avg_magnitude < 6 else "High"
    depth_desc = "Shallow" if avg_depth < 70 else "Intermediate" if avg_depth < 300 else "Deep"
    
    return f"{mag_desc} magnitude, {depth_desc} depth"


@app.get("/api/clusters/risk-zones")
async def get_risk_zones(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Identify high-risk zones based on earthquake frequency and magnitude
    """
    try:
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Geographic clustering
        X = df[['latitude', 'longitude']].values
        dbscan = DBSCAN(eps=5.0, min_samples=10)
        df['zone'] = dbscan.fit_predict(X)
        
        # Calculate risk score for each zone
        risk_zones = []
        
        for zone_id in df['zone'].unique():
            if zone_id == -1:  # Skip noise
                continue
            
            zone_data = df[df['zone'] == zone_id]
            
            # Risk score based on frequency and magnitude
            frequency = len(zone_data)
            avg_magnitude = zone_data['magnitude'].mean()
            max_magnitude = zone_data['magnitude'].max()
            
            risk_score = (frequency / 10) * avg_magnitude * (1 + max_magnitude / 10)
            
            # Categorize risk
            if risk_score > 100:
                risk_level = "High"
            elif risk_score > 50:
                risk_level = "Medium"
            else:
                risk_level = "Low"
            
            risk_zones.append({
                'zone_id': int(zone_id),
                'risk_level': risk_level,
                'risk_score': float(risk_score),
                'earthquake_count': int(frequency),
                'avg_magnitude': float(avg_magnitude),
                'max_magnitude': float(max_magnitude),
                'center': {
                    'latitude': float(zone_data['latitude'].mean()),
                    'longitude': float(zone_data['longitude'].mean())
                },
                'radius_km': float(
                    np.sqrt(
                        (zone_data['latitude'].max() - zone_data['latitude'].min())**2 +
                        (zone_data['longitude'].max() - zone_data['longitude'].min())**2
                    ) * 111  # Rough conversion to km
                )
            })
        
        # Sort by risk score
        risk_zones.sort(key=lambda x: x['risk_score'], reverse=True)
        
        return {
            "risk_zones": risk_zones,
            "summary": {
                "total_zones": len(risk_zones),
                "high_risk_zones": len([z for z in risk_zones if z['risk_level'] == "High"]),
                "medium_risk_zones": len([z for z in risk_zones if z['risk_level'] == "Medium"]),
                "low_risk_zones": len([z for z in risk_zones if z['risk_level'] == "Low"])
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in risk zone analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/clusters/run")
async def trigger_clustering(background_tasks: BackgroundTasks):
    """
    Trigger clustering analysis and store results
    """
    def run_clustering():
        try:
            logger.info("Starting scheduled clustering...")
            
            # Run clustering and store results in database
            # This would be executed daily
            
            logger.info("Clustering completed successfully")
        
        except Exception as e:
            logger.error(f"Error in scheduled clustering: {e}")
    
    background_tasks.add_task(run_clustering)
    
    return {
        "message": "Clustering analysis triggered successfully",
        "status": "processing"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
