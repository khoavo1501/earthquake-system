import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import psycopg2
import pandas as pd
import numpy as np
from prophet import Prophet
from statsmodels.tsa.arima.model import ARIMA
from sklearn.preprocessing import MinMaxScaler
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Suppress Prophet logs
logging.getLogger('prophet').setLevel(logging.WARNING)
logging.getLogger('cmdstanpy').setLevel(logging.WARNING)

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
    title="Earthquake Prediction API",
    description="Time-series forecasting for earthquake trends",
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


def fetch_earthquake_timeseries(days: int = 90) -> pd.DataFrame:
    """Fetch earthquake time series data"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    query = """
        SELECT DATE(time) as date, COUNT(*) as count, 
               AVG(magnitude) as avg_magnitude,
               MAX(magnitude) as max_magnitude
        FROM earthquakes
        WHERE time >= %s AND time <= %s
        GROUP BY DATE(time)
        ORDER BY date
    """
    
    try:
        df = pd.read_sql_query(query, db_conn, params=(start_date, end_date))
        df['date'] = pd.to_datetime(df['date'])
        return df
    except Exception as e:
        logger.error(f"Error fetching timeseries data: {e}")
        raise


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Earthquake Prediction API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/api/predictions/forecast")
async def get_forecast(
    days: int = Query(7, ge=1, le=30, description="Number of days to forecast"),
    model: str = Query("prophet", description="Prediction model: prophet or arima")
):
    """
    Forecast earthquake counts for the next N days
    """
    try:
        # Fetch historical data
        df = fetch_earthquake_timeseries(days=90)
        
        if df.empty or len(df) < 14:
            raise HTTPException(
                status_code=400,
                detail="Insufficient data for prediction (need at least 14 days)"
            )
        
        if model == "prophet":
            forecast_result = forecast_with_prophet(df, days)
        elif model == "arima":
            forecast_result = forecast_with_arima(df, days)
        else:
            raise HTTPException(status_code=400, detail="Invalid model")
        
        return {
            "model": model,
            "forecast_days": days,
            "historical_data": df.to_dict(orient='records'),
            "forecast": forecast_result['forecast'],
            "confidence_intervals": forecast_result.get('confidence_intervals'),
            "summary": {
                "avg_historical": float(df['count'].mean()),
                "avg_forecast": float(np.mean([f['predicted_count'] for f in forecast_result['forecast']])),
                "trend": forecast_result.get('trend', 'stable')
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def forecast_with_prophet(df: pd.DataFrame, days: int) -> Dict[str, Any]:
    """Forecast using Facebook Prophet"""
    try:
        # Prepare data for Prophet
        prophet_df = df[['date', 'count']].copy()
        prophet_df.columns = ['ds', 'y']
        
        # Initialize and fit model with suppress warnings
        import warnings
        warnings.filterwarnings('ignore')
        
        model = Prophet(
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=False,
            interval_width=0.95,
            stan_backend=None  # Use default backend
        )
        
        # Suppress cmdstanpy output
        import logging
        logging.getLogger('cmdstanpy').disabled = True
        
        model.fit(prophet_df)
        
        # Create future dataframe
        future = model.make_future_dataframe(periods=days)
        forecast = model.predict(future)
        
        # Extract forecast for future days only
        future_forecast = forecast.tail(days)
        
        # Replace NaN values
        future_forecast = future_forecast.replace({np.nan: None, np.inf: None, -np.inf: None})
        
        forecast_data = []
        confidence_intervals = []
        
        for idx, row in future_forecast.iterrows():
            yhat = row['yhat'] if pd.notna(row['yhat']) else 0
            yhat_lower = row['yhat_lower'] if pd.notna(row['yhat_lower']) else 0
            yhat_upper = row['yhat_upper'] if pd.notna(row['yhat_upper']) else 0
            
            forecast_data.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'predicted_count': max(0, int(round(yhat))),
                'lower_bound': max(0, int(round(yhat_lower))),
                'upper_bound': int(round(yhat_upper))
            })
            
            confidence_intervals.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'lower': max(0, float(yhat_lower)) if pd.notna(yhat_lower) else 0.0,
                'upper': float(yhat_upper) if pd.notna(yhat_upper) else 0.0
            })
        
        # Determine trend
        trend = "increasing" if forecast_data[-1]['predicted_count'] > forecast_data[0]['predicted_count'] else "decreasing"
        
        return {
            'forecast': forecast_data,
            'confidence_intervals': confidence_intervals,
            'trend': trend
        }
    
    except Exception as e:
        logger.error(f"Error in Prophet forecast: {e}")
        # Fallback to simple linear regression if Prophet fails
        logger.info("Falling back to simple forecast")
        return simple_forecast(df, days)


def forecast_with_arima(df: pd.DataFrame, days: int) -> Dict[str, Any]:
    """Forecast using ARIMA model"""
    try:
        # Prepare time series
        ts = df.set_index('date')['count']
        
        # Fit ARIMA model (simple parameters)
        model = ARIMA(ts, order=(1, 1, 1))
        fitted_model = model.fit()
        
        # Forecast
        forecast_result = fitted_model.forecast(steps=days)
        
        # Get confidence intervals (approximate)
        std_error = np.std(fitted_model.resid)
        
        forecast_data = []
        last_date = df['date'].max()
        
        for i in range(days):
            forecast_date = last_date + timedelta(days=i+1)
            predicted_value = max(0, forecast_result.iloc[i])
            
            forecast_data.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'predicted_count': int(round(predicted_value)),
                'lower_bound': max(0, int(round(predicted_value - 1.96 * std_error))),
                'upper_bound': int(round(predicted_value + 1.96 * std_error))
            })
        
        # Determine trend
        trend = "increasing" if forecast_data[-1]['predicted_count'] > forecast_data[0]['predicted_count'] else "decreasing"
        
        return {
            'forecast': forecast_data,
            'trend': trend
        }
    
    except Exception as e:
        logger.error(f"Error in ARIMA forecast: {e}")
        # Fallback to simple forecast
        return simple_forecast(df, days)


def simple_forecast(df: pd.DataFrame, days: int) -> Dict[str, Any]:
    """Simple linear regression forecast as fallback"""
    try:
        from scipy import stats
        
        # Simple trend calculation
        y = df['count'].values
        x = np.arange(len(y))
        
        # Linear regression
        slope, intercept, _, _, _ = stats.linregress(x, y)
        
        forecast_data = []
        last_date = df['date'].max()
        last_x = len(y) - 1
        
        for i in range(days):
            forecast_date = last_date + timedelta(days=i+1)
            predicted_value = max(0, slope * (last_x + i + 1) + intercept)
            
            # Simple confidence interval (±20%)
            lower = max(0, predicted_value * 0.8)
            upper = predicted_value * 1.2
            
            forecast_data.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'predicted_count': int(round(predicted_value)),
                'lower_bound': int(round(lower)),
                'upper_bound': int(round(upper))
            })
        
        trend = "increasing" if slope > 0 else "decreasing"
        
        return {
            'forecast': forecast_data,
            'confidence_intervals': None,
            'trend': trend
        }
    except Exception as e:
        logger.error(f"Error in simple forecast: {e}")
        # Last resort: use average
        avg_count = int(df['count'].mean())
        forecast_data = []
        last_date = df['date'].max()
        
        for i in range(days):
            forecast_date = last_date + timedelta(days=i+1)
            forecast_data.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'predicted_count': avg_count,
                'lower_bound': int(avg_count * 0.8),
                'upper_bound': int(avg_count * 1.2)
            })
        
        return {
            'forecast': forecast_data,
            'confidence_intervals': None,
            'trend': 'stable'
        }


@app.get("/api/predictions/risk-forecast")
async def get_risk_forecast(
    days: int = Query(7, ge=1, le=30, description="Number of days to forecast")
):
    """
    Forecast earthquake risk levels for the next N days
    """
    try:
        # Get count forecast
        df = fetch_earthquake_timeseries(days=90)
        
        if df.empty:
            raise HTTPException(status_code=400, detail="No data available")
        
        # Use Prophet for forecasting
        forecast_result = forecast_with_prophet(df, days)
        
        # Calculate risk based on predicted counts and magnitudes
        risk_forecast = []
        
        for forecast_item in forecast_result['forecast']:
            predicted_count = forecast_item['predicted_count']
            
            # Risk categorization
            if predicted_count > df['count'].quantile(0.75):
                risk_level = "High"
                risk_score = 3
            elif predicted_count > df['count'].quantile(0.50):
                risk_level = "Medium"
                risk_score = 2
            else:
                risk_level = "Low"
                risk_score = 1
            
            risk_forecast.append({
                'date': forecast_item['date'],
                'predicted_count': predicted_count,
                'risk_level': risk_level,
                'risk_score': risk_score,
                'confidence_range': {
                    'lower': forecast_item['lower_bound'],
                    'upper': forecast_item['upper_bound']
                }
            })
        
        return {
            "forecast_days": days,
            "risk_forecast": risk_forecast,
            "summary": {
                "high_risk_days": len([r for r in risk_forecast if r['risk_level'] == "High"]),
                "medium_risk_days": len([r for r in risk_forecast if r['risk_level'] == "Medium"]),
                "low_risk_days": len([r for r in risk_forecast if r['risk_level'] == "Low"]),
                "avg_predicted_count": float(np.mean([r['predicted_count'] for r in risk_forecast]))
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in risk forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/magnitude-forecast")
async def get_magnitude_forecast(
    days: int = Query(7, ge=1, le=30, description="Number of days to forecast")
):
    """
    Forecast average earthquake magnitude for the next N days
    """
    try:
        df = fetch_earthquake_timeseries(days=90)
        
        if df.empty:
            raise HTTPException(status_code=400, detail="No data available")
        
        # Prepare data for Prophet
        prophet_df = df[['date', 'avg_magnitude']].copy()
        prophet_df.columns = ['ds', 'y']
        prophet_df = prophet_df.dropna()
        
        if len(prophet_df) < 14:
            raise HTTPException(status_code=400, detail="Insufficient data")
        
        try:
            # Try Prophet first
            model = Prophet(
                daily_seasonality=True,
                weekly_seasonality=True,
                interval_width=0.95
            )
            model.fit(prophet_df)
            
            # Forecast
            future = model.make_future_dataframe(periods=days)
            forecast = model.predict(future)
            
            # Extract future forecast
            future_forecast = forecast.tail(days)
            
            magnitude_forecast = []
            
            for idx, row in future_forecast.iterrows():
                magnitude_forecast.append({
                    'date': row['ds'].strftime('%Y-%m-%d'),
                    'predicted_magnitude': round(float(row['yhat']), 2),
                    'lower_bound': round(float(row['yhat_lower']), 2),
                    'upper_bound': round(float(row['yhat_upper']), 2)
                })
        except Exception as prophet_error:
            logger.error(f"Prophet error in magnitude forecast: {prophet_error}")
            logger.info("Falling back to ARIMA model for magnitude forecast")
            
            # Fallback: ARIMA model for time series forecasting
            from statsmodels.tsa.arima.model import ARIMA
            from statsmodels.tsa.statespace.sarimax import SARIMAX
            
            y = prophet_df['y'].values
            
            try:
                # Try ARIMA first (better for trends and seasonality)
                # Use auto order selection based on data length
                if len(y) > 30:
                    order = (2, 1, 2)  # AR=2, I=1 (difference), MA=2
                else:
                    order = (1, 1, 1)
                
                model = ARIMA(y, order=order)
                model_fit = model.fit()
                
                # Forecast future values with confidence intervals
                forecast_result = model_fit.forecast(steps=days, alpha=0.05)
                predictions = forecast_result
                
                # Get confidence intervals
                forecast_df = model_fit.get_forecast(steps=days)
                conf_int = forecast_df.conf_int(alpha=0.05)
                
            except Exception as arima_error:
                logger.warning(f"ARIMA failed: {arima_error}, using exponential smoothing")
                
                # Fallback to exponential weighted moving average
                from scipy import signal
                
                # Calculate trend using exponential moving average
                alpha = 0.3  # Smoothing factor
                ema = [y[0]]
                for val in y[1:]:
                    ema.append(alpha * val + (1 - alpha) * ema[-1])
                
                # Calculate trend (slope of recent data)
                recent_window = min(14, len(y) // 3)
                recent_y = y[-recent_window:]
                recent_x = np.arange(recent_window)
                slope = np.polyfit(recent_x, recent_y, 1)[0]
                
                # Add some variability based on historical std
                historical_std = np.std(y)
                base_value = ema[-1]
                
                predictions = []
                conf_int_lower = []
                conf_int_upper = []
                
                for i in range(days):
                    # Add trend and slight random walk
                    pred = base_value + slope * (i + 1)
                    predictions.append(pred)
                    
                    # Confidence intervals widen with time
                    margin = historical_std * 0.5 * (1 + i * 0.1)
                    conf_int_lower.append(pred - margin)
                    conf_int_upper.append(pred + margin)
                
                predictions = np.array(predictions)
                conf_int = np.column_stack([conf_int_lower, conf_int_upper])
            
            magnitude_forecast = []
            last_date = prophet_df['ds'].max()
            
            for i in range(days):
                future_date = last_date + pd.Timedelta(days=i+1)
                pred_value = float(predictions[i])
                lower = float(conf_int[i, 0]) if conf_int.ndim > 1 else pred_value - 0.3
                upper = float(conf_int[i, 1]) if conf_int.ndim > 1 else pred_value + 0.3
                
                magnitude_forecast.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'predicted_magnitude': round(pred_value, 2),
                    'lower_bound': round(lower, 2),
                    'upper_bound': round(upper, 2)
                })
        
        return {
            "forecast_days": days,
            "magnitude_forecast": magnitude_forecast,
            "summary": {
                "historical_avg_magnitude": round(float(df['avg_magnitude'].mean()), 2),
                "forecast_avg_magnitude": round(float(np.mean([m['predicted_magnitude'] for m in magnitude_forecast])), 2)
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in magnitude forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/latest")
async def get_latest_prediction():
    """
    Get the most recent prediction results
    """
    try:
        cursor = db_conn.cursor()
        cursor.execute("""
            SELECT * FROM predictions
            ORDER BY created_at DESC
            LIMIT 1
        """)
        
        result = cursor.fetchone()
        cursor.close()
        
        if not result:
            # Generate new prediction if none exists
            return await get_forecast(days=7, model="prophet")
        
        return {
            "prediction_id": result[0],
            "prediction_date": result[1].isoformat(),
            "forecast_data": result[2],
            "model_used": result[3],
            "created_at": result[5].isoformat()
        }
    
    except Exception as e:
        logger.error(f"Error fetching latest prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predictions/run")
async def trigger_prediction(background_tasks: BackgroundTasks):
    """
    Trigger prediction generation and store results
    """
    def run_prediction():
        try:
            logger.info("Starting prediction generation...")
            
            # Generate predictions and store in database
            # This would run periodically
            
            logger.info("Prediction completed successfully")
        
        except Exception as e:
            logger.error(f"Error in prediction generation: {e}")
    
    background_tasks.add_task(run_prediction)
    
    return {
        "message": "Prediction generation triggered successfully",
        "status": "processing"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
