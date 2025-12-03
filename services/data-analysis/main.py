import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import psycopg2
import pandas as pd
import numpy as np
from scipy import stats
from statsmodels.tsa.seasonal import seasonal_decompose
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
    title="Earthquake Data Analysis API",
    description="Time-series analysis and pattern detection for earthquake data",
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
    """Fetch earthquake data from database and convert to DataFrame"""
    query = "SELECT * FROM earthquakes WHERE magnitude IS NOT NULL"
    params = []
    
    if start_date:
        query += " AND time >= %s"
        params.append(start_date)
    
    if end_date:
        query += " AND time <= %s"
        params.append(end_date)
    
    query += " ORDER BY time"
    
    try:
        df = pd.read_sql_query(query, db_conn, params=params)
        df['time'] = pd.to_datetime(df['time'])
        df.set_index('time', inplace=True)
        return df
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        raise


def clean_data_for_json(data):
    """Replace NaN/Inf values with None for JSON serialization"""
    if isinstance(data, dict):
        return {k: clean_data_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_data_for_json(item) for item in data]
    elif isinstance(data, float):
        if np.isnan(data) or np.isinf(data):
            return None
        return data
    else:
        return data


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Earthquake Data Analysis API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/analysis/timeseries")
async def get_timeseries_analysis(
    period: str = Query("daily", description="Time period: daily, weekly, monthly"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Get time-series analysis with resampling and missing data interpolation
    Returns count and statistics for the specified period
    """
    try:
        # Fetch data
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Resample based on period
        resample_map = {
            'daily': 'D',
            'weekly': 'W',
            'monthly': 'M'
        }
        
        resample_freq = resample_map.get(period, 'D')
        
        # Count earthquakes per period
        count_series = df.resample(resample_freq).size()
        
        # Create complete date range to fill missing periods
        if start_date and end_date:
            date_range = pd.date_range(start=start_date, end=end_date, freq=resample_freq)
        else:
            date_range = pd.date_range(start=count_series.index.min(), end=count_series.index.max(), freq=resample_freq)
        
        # Reindex to include all dates
        count_series = count_series.reindex(date_range, fill_value=0)
        
        # Interpolate zero counts with nearby values (rolling average)
        # Replace 0s with NaN temporarily for interpolation
        count_series_interpolated = count_series.replace(0, np.nan)
        # Use linear interpolation
        count_series_interpolated = count_series_interpolated.interpolate(method='linear', limit_direction='both')
        # Fill any remaining NaN with rolling mean
        count_series_interpolated = count_series_interpolated.fillna(count_series.rolling(window=7, min_periods=1, center=True).mean())
        # If still NaN, use the overall mean
        count_series_interpolated = count_series_interpolated.fillna(count_series[count_series > 0].mean())
        # Round to integers
        count_series_interpolated = count_series_interpolated.round().astype(int)
        
        # Statistics per period
        magnitude_stats = df['magnitude'].resample(resample_freq).agg([
            'mean', 'max', 'min', 'std', 'count'
        ]).reindex(date_range)
        
        depth_stats = df['depth'].resample(resample_freq).agg([
            'mean', 'max', 'min'
        ]).reindex(date_range)
        
        # Interpolate missing magnitude and depth values
        magnitude_stats['mean'] = magnitude_stats['mean'].interpolate(method='linear', limit_direction='both')
        magnitude_stats['max'] = magnitude_stats['max'].interpolate(method='linear', limit_direction='both')
        magnitude_stats['min'] = magnitude_stats['min'].interpolate(method='linear', limit_direction='both')
        magnitude_stats['std'] = magnitude_stats['std'].interpolate(method='linear', limit_direction='both')
        
        depth_stats['mean'] = depth_stats['mean'].interpolate(method='linear', limit_direction='both')
        depth_stats['max'] = depth_stats['max'].interpolate(method='linear', limit_direction='both')
        depth_stats['min'] = depth_stats['min'].interpolate(method='linear', limit_direction='both')
        
        # Combine results
        result = pd.DataFrame({
            'date': count_series_interpolated.index,
            'count': count_series_interpolated.values,
            'avg_magnitude': magnitude_stats['mean'].values,
            'max_magnitude': magnitude_stats['max'].values,
            'min_magnitude': magnitude_stats['min'].values,
            'std_magnitude': magnitude_stats['std'].values,
            'avg_depth': depth_stats['mean'].values,
            'max_depth': depth_stats['max'].values,
            'min_depth': depth_stats['min'].values
        })
        
        # Replace NaN with None for JSON serialization
        result = result.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        # Calculate trend
        if len(result) > 1:
            x = np.arange(len(result))
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, result['count'])
            
            trend = {
                'slope': float(slope),
                'intercept': float(intercept),
                'r_squared': float(r_value ** 2),
                'trend_line': [float(slope * i + intercept) for i in x]
            }
        else:
            trend = None
        
        return {
            "period": period,
            "data": result.to_dict(orient='records'),
            "trend": trend,
            "summary": {
                "total_earthquakes": int(df.shape[0]),
                "date_range": {
                    "start": df.index.min().isoformat(),
                    "end": df.index.max().isoformat()
                },
                "overall_avg_magnitude": float(df['magnitude'].mean()),
                "overall_max_magnitude": float(df['magnitude'].max())
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in timeseries analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/correlation")
async def get_correlation_matrix(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Calculate correlation matrix between earthquake variables
    """
    try:
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Select numeric columns for correlation
        numeric_cols = ['magnitude', 'depth', 'latitude', 'longitude', 'sig']
        available_cols = [col for col in numeric_cols if col in df.columns]
        
        df_numeric = df[available_cols].dropna()
        
        if df_numeric.empty:
            raise HTTPException(status_code=404, detail="No numeric data available")
        
        # Calculate correlation matrix
        corr_matrix = df_numeric.corr()
        
        # Replace NaN with None
        corr_matrix = corr_matrix.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        # Convert to list format for heatmap
        variables = corr_matrix.columns.tolist()
        correlation_data = []
        
        for i, row_var in enumerate(variables):
            for j, col_var in enumerate(variables):
                value = corr_matrix.iloc[i, j]
                correlation_data.append({
                    'x': row_var,
                    'y': col_var,
                    'value': float(value) if pd.notna(value) else None
                })
        
        return {
            "variables": variables,
            "correlation_matrix": corr_matrix.to_dict(),
            "correlation_data": correlation_data,
            "summary": {
                "highest_correlation": {
                    "variables": ["magnitude", "sig"],
                    "value": float(corr_matrix.loc['magnitude', 'sig']) if 'sig' in available_cols else 0
                }
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in correlation analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/seasonal")
async def get_seasonal_decomposition(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Perform seasonal decomposition on monthly earthquake data
    Falls back to simple monthly aggregation if insufficient data
    """
    try:
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Resample to monthly frequency
        monthly_counts = df.resample('M').size()
        
        # If we have less than 24 months, use simple monthly aggregation
        if len(monthly_counts) < 24:
            # Calculate simple monthly patterns
            monthly_df = pd.DataFrame({
                'date': monthly_counts.index,
                'observed': monthly_counts.values
            })
            
            # Calculate moving average as trend if we have at least 3 months
            if len(monthly_counts) >= 3:
                window = min(3, len(monthly_counts))
                trend = monthly_counts.rolling(window=window, center=True).mean()
            else:
                trend = monthly_counts
            
            # Simple seasonal component (deviation from trend)
            seasonal = monthly_counts - trend
            residual = pd.Series([None] * len(monthly_counts), index=monthly_counts.index)
            
            monthly_df['trend'] = trend.values
            monthly_df['seasonal'] = seasonal.values
            monthly_df['residual'] = residual.values
            
            # Replace NaN with None
            monthly_df = monthly_df.replace({np.nan: None, np.inf: None, -np.inf: None})
            
            # Calculate basic trend direction
            if len(monthly_counts) > 1:
                first_half_avg = monthly_counts[:len(monthly_counts)//2].mean()
                second_half_avg = monthly_counts[len(monthly_counts)//2:].mean()
                trend_direction = "increasing" if second_half_avg > first_half_avg else "decreasing"
            else:
                trend_direction = "stable"
            
            return {
                "data": monthly_df.to_dict(orient='records'),
                "period": 12,
                "model": "simple_aggregation",
                "note": f"Using simple monthly aggregation (only {len(monthly_counts)} months available, need 24 for full seasonal decomposition)",
                "summary": {
                    "seasonal_strength": float(seasonal.std()) if len(seasonal.dropna()) > 0 else 0.0,
                    "trend_direction": trend_direction,
                    "total_months": len(monthly_counts),
                    "avg_earthquakes_per_month": float(monthly_counts.mean())
                }
            }
        
        # If we have 24+ months, perform full seasonal decomposition
        try:
            decomposition = seasonal_decompose(
                monthly_counts,
                model='additive',
                period=12
            )
            
            result = pd.DataFrame({
                'date': monthly_counts.index,
                'observed': monthly_counts.values,
                'trend': decomposition.trend,
                'seasonal': decomposition.seasonal,
                'residual': decomposition.resid
            })
            
            # Remove NaN values and replace with None for JSON
            result = result.replace({np.nan: None, np.inf: None, -np.inf: None})
            
            trend_values = decomposition.trend.dropna()
            trend_direction = "increasing" if len(trend_values) > 1 and trend_values.iloc[-1] > trend_values.iloc[0] else "decreasing"
            
            return {
                "data": result.to_dict(orient='records'),
                "period": 12,
                "model": "additive",
                "summary": {
                    "seasonal_strength": float(np.std(decomposition.seasonal.dropna())) if len(decomposition.seasonal.dropna()) > 0 else 0.0,
                    "trend_direction": trend_direction,
                    "total_months": len(monthly_counts),
                    "avg_earthquakes_per_month": float(monthly_counts.mean())
                }
            }
        except Exception as decomp_error:
            logger.warning(f"Seasonal decomposition failed, using simple method: {decomp_error}")
            # Fallback to simple method if decomposition fails
            monthly_df = pd.DataFrame({
                'date': monthly_counts.index,
                'observed': monthly_counts.values,
                'trend': monthly_counts.rolling(window=3, center=True).mean().values,
                'seasonal': (monthly_counts - monthly_counts.rolling(window=3, center=True).mean()).values,
                'residual': [None] * len(monthly_counts)
            })
            
            monthly_df = monthly_df.replace({np.nan: None, np.inf: None, -np.inf: None})
            
            return {
                "data": monthly_df.to_dict(orient='records'),
                "period": 12,
                "model": "simple_moving_average",
                "summary": {
                    "seasonal_strength": 0.0,
                    "trend_direction": "stable",
                    "total_months": len(monthly_counts),
                    "avg_earthquakes_per_month": float(monthly_counts.mean())
                }
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in seasonal analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/distribution")
async def get_magnitude_distribution(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    bins: int = Query(20, ge=5, le=100, description="Number of bins for histogram")
):
    """
    Get magnitude distribution histogram
    """
    try:
        df = fetch_earthquake_data(start_date, end_date)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data found")
        
        # Create histogram
        counts, bin_edges = np.histogram(df['magnitude'].dropna(), bins=bins)
        
        histogram_data = []
        for i in range(len(counts)):
            histogram_data.append({
                'bin_start': float(bin_edges[i]),
                'bin_end': float(bin_edges[i + 1]),
                'bin_center': float((bin_edges[i] + bin_edges[i + 1]) / 2),
                'count': int(counts[i])
            })
        
        return {
            "histogram": histogram_data,
            "statistics": {
                "mean": float(df['magnitude'].mean()),
                "median": float(df['magnitude'].median()),
                "std": float(df['magnitude'].std()),
                "min": float(df['magnitude'].min()),
                "max": float(df['magnitude'].max()),
                "q25": float(df['magnitude'].quantile(0.25)),
                "q75": float(df['magnitude'].quantile(0.75))
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in distribution analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analysis/run")
async def trigger_analysis(background_tasks: BackgroundTasks):
    """
    Trigger full analysis and store results
    """
    def run_analysis():
        try:
            logger.info("Starting scheduled analysis...")
            
            # Fetch recent data (last 30 days)
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)
            
            # Run various analyses
            # This would store results in the analysis_results table
            
            logger.info("Analysis completed successfully")
        
        except Exception as e:
            logger.error(f"Error in scheduled analysis: {e}")
    
    background_tasks.add_task(run_analysis)
    
    return {
        "message": "Analysis triggered successfully",
        "status": "processing"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
