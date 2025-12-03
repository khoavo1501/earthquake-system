import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
import redis
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database and Redis connections
db_conn = None
redis_client = None


class Earthquake(BaseModel):
    """Earthquake data model"""
    id: str
    time: datetime
    latitude: float
    longitude: float
    depth: Optional[float] = None
    magnitude: Optional[float] = None
    magnitude_type: Optional[str] = None
    place: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    tsunami: Optional[int] = None
    sig: Optional[int] = None


class EarthquakeStats(BaseModel):
    """Statistics model"""
    total_count: int
    avg_magnitude: float
    max_magnitude: float
    min_magnitude: float
    avg_depth: float
    date_range_start: datetime
    date_range_end: datetime


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown"""
    global db_conn, redis_client
    
    # Startup
    db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres123@localhost:5432/earthquake_db')
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
    
    try:
        db_conn = psycopg2.connect(db_url)
        logger.info("Database connection established")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
    
    try:
        redis_client = redis.from_url(redis_url, decode_responses=True)
        redis_client.ping()
        logger.info("Redis connection established")
    except Exception as e:
        logger.error(f"Redis connection failed: {e}")
        redis_client = None
    
    yield
    
    # Shutdown
    if db_conn:
        db_conn.close()
        logger.info("Database connection closed")
    if redis_client:
        redis_client.close()
        logger.info("Redis connection closed")


app = FastAPI(
    title="Earthquake Database API",
    description="RESTful API for earthquake data management",
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


def get_from_cache(key: str) -> Optional[Any]:
    """Get data from Redis cache"""
    if redis_client is None:
        return None
    
    try:
        data = redis_client.get(key)
        return json.loads(data) if data else None
    except Exception as e:
        logger.warning(f"Cache get error: {e}")
        return None


def set_to_cache(key: str, value: Any, expire: int = 300):
    """Set data to Redis cache with expiration (default 5 minutes)"""
    if redis_client is None:
        return
    
    try:
        redis_client.setex(key, expire, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache set error: {e}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Earthquake Database API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/earthquakes", response_model=Dict[str, Any])
async def get_earthquakes(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    min_magnitude: Optional[float] = Query(None, ge=0, le=10, description="Minimum magnitude"),
    max_magnitude: Optional[float] = Query(None, ge=0, le=10, description="Maximum magnitude"),
    min_depth: Optional[float] = Query(None, description="Minimum depth"),
    max_depth: Optional[float] = Query(None, description="Maximum depth")
):
    """
    Get list of earthquakes with pagination and filters
    """
    # Build cache key
    cache_key = f"earthquakes:page={page}:limit={limit}:start={start_date}:end={end_date}:minmag={min_magnitude}:maxmag={max_magnitude}"
    
    # Check cache
    cached_data = get_from_cache(cache_key)
    if cached_data:
        logger.info(f"Cache hit for key: {cache_key}")
        return cached_data
    
    # Build query
    query = "SELECT * FROM earthquakes WHERE 1=1"
    params = []
    count_query = "SELECT COUNT(*) FROM earthquakes WHERE 1=1"
    
    if start_date:
        query += " AND time >= %s"
        count_query += " AND time >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND time <= %s"
        count_query += " AND time <= %s"
        params.append(end_date)
    
    if min_magnitude is not None:
        query += " AND magnitude >= %s"
        count_query += " AND magnitude >= %s"
        params.append(min_magnitude)
    
    if max_magnitude is not None:
        query += " AND magnitude <= %s"
        count_query += " AND magnitude <= %s"
        params.append(max_magnitude)
    
    if min_depth is not None:
        query += " AND depth >= %s"
        count_query += " AND depth >= %s"
        params.append(min_depth)
    
    if max_depth is not None:
        query += " AND depth <= %s"
        count_query += " AND depth <= %s"
        params.append(max_depth)
    
    query += " ORDER BY time DESC LIMIT %s OFFSET %s"
    params.extend([limit, (page - 1) * limit])
    
    try:
        cursor = db_conn.cursor(cursor_factory=RealDictCursor)
        
        # Get total count
        cursor.execute(count_query, params[:-2] if len(params) > 2 else [])
        total_count = cursor.fetchone()['count']
        
        # Get data
        cursor.execute(query, params)
        earthquakes = cursor.fetchall()
        
        cursor.close()
        
        result = {
            "data": earthquakes,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_count,
                "pages": (total_count + limit - 1) // limit
            }
        }
        
        # Cache the result
        set_to_cache(cache_key, result)
        
        return result
    
    except Exception as e:
        logger.error(f"Error fetching earthquakes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/earthquakes/stats", response_model=EarthquakeStats)
async def get_statistics(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Get statistical summary of earthquakes"""
    cache_key = f"stats:start={start_date}:end={end_date}"
    
    # Check cache
    cached_data = get_from_cache(cache_key)
    if cached_data:
        return cached_data
    
    query = """
        SELECT 
            COUNT(*) as total_count,
            AVG(magnitude) as avg_magnitude,
            MAX(magnitude) as max_magnitude,
            MIN(magnitude) as min_magnitude,
            AVG(depth) as avg_depth,
            MIN(time) as date_range_start,
            MAX(time) as date_range_end
        FROM earthquakes
        WHERE 1=1
    """
    params = []
    
    if start_date:
        query += " AND time >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND time <= %s"
        params.append(end_date)
    
    try:
        cursor = db_conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, params)
        stats = cursor.fetchone()
        cursor.close()
        
        if not stats or stats['total_count'] == 0 or stats['total_count'] is None:
            raise HTTPException(status_code=404, detail="No earthquake data found")
        
        # Ensure all required fields are present
        result = {
            'total_count': int(stats['total_count']),
            'avg_magnitude': float(stats['avg_magnitude']) if stats['avg_magnitude'] else 0.0,
            'max_magnitude': float(stats['max_magnitude']) if stats['max_magnitude'] else 0.0,
            'min_magnitude': float(stats['min_magnitude']) if stats['min_magnitude'] else 0.0,
            'avg_depth': float(stats['avg_depth']) if stats['avg_depth'] else 0.0,
            'date_range_start': stats['date_range_start'],
            'date_range_end': stats['date_range_end']
        }
        
        # Cache the result
        set_to_cache(cache_key, result, expire=300)
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/earthquakes/{earthquake_id}", response_model=Earthquake)
async def get_earthquake(earthquake_id: str):
    """Get earthquake by ID"""
    cache_key = f"earthquake:{earthquake_id}"
    
    # Check cache
    cached_data = get_from_cache(cache_key)
    if cached_data:
        return cached_data
    
    try:
        cursor = db_conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM earthquakes WHERE id = %s", (earthquake_id,))
        earthquake = cursor.fetchone()
        cursor.close()
        
        if not earthquake:
            raise HTTPException(status_code=404, detail="Earthquake not found")
        
        # Cache the result
        set_to_cache(cache_key, dict(earthquake), expire=600)
        
        return earthquake
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching earthquake: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/earthquakes")
async def create_earthquake(earthquake: Earthquake):
    """Create new earthquake record (admin only)"""
    query = """
        INSERT INTO earthquakes (
            id, time, latitude, longitude, depth, magnitude, magnitude_type,
            place, type, status, tsunami, sig
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        RETURNING *
    """
    
    try:
        cursor = db_conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, (
            earthquake.id, earthquake.time, earthquake.latitude, earthquake.longitude,
            earthquake.depth, earthquake.magnitude, earthquake.magnitude_type,
            earthquake.place, earthquake.type, earthquake.status, earthquake.tsunami,
            earthquake.sig
        ))
        result = cursor.fetchone()
        db_conn.commit()
        cursor.close()
        
        return {"message": "Earthquake created successfully", "data": result}
    
    except Exception as e:
        db_conn.rollback()
        logger.error(f"Error creating earthquake: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/earthquakes/load-historical")
async def load_historical_data(request: dict):
    """Trigger historical data load from USGS API"""
    start_date = request.get('start_date')
    end_date = request.get('end_date')
    
    if not start_date or not end_date:
        raise HTTPException(status_code=400, detail="start_date and end_date are required")
    
    try:
        import requests
        from datetime import datetime, timedelta
        import time
        
        # Parse dates
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        
        # USGS API has limits: max 20000 events per request
        # Split into monthly chunks to avoid limits
        all_features = []
        current_start = start
        
        logger.info(f"Fetching historical data from {start_date} to {end_date}")
        
        while current_start < end:
            # Calculate end of current chunk (1 month or end date, whichever is earlier)
            current_end = min(
                current_start + timedelta(days=30),
                end
            )
            
            # USGS API endpoint
            usgs_url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
            params = {
                'format': 'geojson',
                'starttime': current_start.strftime('%Y-%m-%d'),
                'endtime': current_end.strftime('%Y-%m-%d'),
                'minmagnitude': 2.5,
                'orderby': 'time'
            }
            
            logger.info(f"Fetching chunk: {current_start.strftime('%Y-%m-%d')} to {current_end.strftime('%Y-%m-%d')}")
            
            try:
                response = requests.get(usgs_url, params=params, timeout=60)
                response.raise_for_status()
                
                data = response.json()
                features = data.get('features', [])
                all_features.extend(features)
                
                logger.info(f"Fetched {len(features)} records for chunk")
                
                # Rate limiting: wait 1 second between requests
                time.sleep(1)
                
            except requests.exceptions.HTTPError as e:
                logger.warning(f"HTTP error for chunk {current_start} to {current_end}: {e}")
                # Continue to next chunk even if this one fails
            except Exception as e:
                logger.warning(f"Error fetching chunk {current_start} to {current_end}: {e}")
            
            # Move to next chunk
            current_start = current_end + timedelta(days=1)
        
        if not all_features:
            return {"message": "No data found for the specified date range", "count": 0}
        
        logger.info(f"Total features fetched: {len(all_features)}")
        
        # Insert data into database
        inserted = 0
        failed = 0
        cursor = db_conn.cursor()
        
        for feature in all_features:
            try:
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                query = """
                    INSERT INTO earthquakes (
                        id, time, latitude, longitude, depth, magnitude, 
                        magnitude_type, place, type, status, tsunami, sig,
                        nst, dmin, rms, gap, updated
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        magnitude = EXCLUDED.magnitude,
                        updated = EXCLUDED.updated
                """
                
                cursor.execute(query, (
                    feature['id'],
                    datetime.fromtimestamp(props['time'] / 1000) if props.get('time') else None,
                    coords[1], coords[0], coords[2],
                    props.get('mag'), props.get('magType'),
                    props.get('place'), props.get('type'),
                    props.get('status'), props.get('tsunami', 0),
                    props.get('sig'),
                    props.get('nst'), props.get('dmin'), props.get('rms'),
                    props.get('gap'),
                    datetime.fromtimestamp(props['updated'] / 1000) if props.get('updated') else None
                ))
                
                # Commit after each successful insert to avoid transaction block
                db_conn.commit()
                inserted += 1
                
            except Exception as e:
                # Rollback the failed transaction
                db_conn.rollback()
                failed += 1
                logger.warning(f"Failed to insert record {feature.get('id')}: {e}")
                continue
        
        cursor.close()
        
        # Clear cache
        redis_client.flushdb()
        
        logger.info(f"Successfully loaded {inserted} records ({failed} failed) from {start_date} to {end_date}")
        return {
            "message": f"Successfully loaded historical data",
            "count": inserted,
            "failed": failed,
            "total_features": len(all_features),
            "start_date": start_date,
            "end_date": end_date
        }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching from USGS API: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch data from USGS: {str(e)}")
    except Exception as e:
        db_conn.rollback()
        logger.error(f"Error loading historical data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/earthquakes/{earthquake_id}")
async def update_earthquake(earthquake_id: str, earthquake: Earthquake):
    """Update earthquake record"""
    query = """
        UPDATE earthquakes SET
            time = %s, latitude = %s, longitude = %s, depth = %s,
            magnitude = %s, magnitude_type = %s, place = %s,
            type = %s, status = %s, tsunami = %s, sig = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
        RETURNING *
    """
    
    try:
        cursor = db_conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(query, (
            earthquake.time, earthquake.latitude, earthquake.longitude,
            earthquake.depth, earthquake.magnitude, earthquake.magnitude_type,
            earthquake.place, earthquake.type, earthquake.status, earthquake.tsunami,
            earthquake.sig, earthquake_id
        ))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Earthquake not found")
        
        result = cursor.fetchone()
        db_conn.commit()
        cursor.close()
        
        # Invalidate cache
        redis_client.delete(f"earthquake:{earthquake_id}")
        
        return {"message": "Earthquake updated successfully", "data": result}
    
    except HTTPException:
        raise
    except Exception as e:
        db_conn.rollback()
        logger.error(f"Error updating earthquake: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/earthquakes/{earthquake_id}")
async def delete_earthquake(earthquake_id: str):
    """Delete earthquake record"""
    try:
        cursor = db_conn.cursor()
        cursor.execute("DELETE FROM earthquakes WHERE id = %s", (earthquake_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Earthquake not found")
        
        db_conn.commit()
        cursor.close()
        
        # Invalidate cache
        redis_client.delete(f"earthquake:{earthquake_id}")
        
        return {"message": "Earthquake deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        db_conn.rollback()
        logger.error(f"Error deleting earthquake: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
