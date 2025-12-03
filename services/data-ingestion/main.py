import os
import time
import logging
import schedule
import requests
import psycopg2
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class USGSDataFetcher:
    """Fetches earthquake data from USGS API"""
    
    def __init__(self, api_url: str):
        self.api_url = api_url
        
    def fetch_earthquakes(self, start_time: datetime = None, end_time: datetime = None) -> List[Dict[str, Any]]:
        """
        Fetch earthquake data from USGS API
        
        Args:
            start_time: Start time for data fetch (default: 30 days ago)
            end_time: End time for data fetch (default: now)
        
        Returns:
            List of earthquake records
        """
        if end_time is None:
            end_time = datetime.utcnow()
        if start_time is None:
            start_time = end_time - timedelta(days=30)
        
        params = {
            'format': 'geojson',
            'starttime': start_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'endtime': end_time.strftime('%Y-%m-%dT%H:%M:%S'),
            'minmagnitude': 2.5,  # Filter for significant earthquakes
            'orderby': 'time'
        }
        
        try:
            logger.info(f"Fetching earthquakes from {start_time} to {end_time}")
            response = requests.get(self.api_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            features = data.get('features', [])
            logger.info(f"Fetched {len(features)} earthquake records")
            
            return self._parse_features(features)
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching data from USGS API: {e}")
            return []
    
    def _parse_features(self, features: List[Dict]) -> List[Dict[str, Any]]:
        """Parse USGS GeoJSON features into database format"""
        earthquakes = []
        
        for feature in features:
            props = feature.get('properties', {})
            geometry = feature.get('geometry', {})
            coords = geometry.get('coordinates', [None, None, None])
            
            earthquake = {
                'id': feature.get('id'),
                'time': datetime.fromtimestamp(props.get('time', 0) / 1000),
                'latitude': coords[1] if len(coords) > 1 else None,
                'longitude': coords[0] if len(coords) > 0 else None,
                'depth': coords[2] if len(coords) > 2 else None,
                'magnitude': props.get('mag'),
                'magnitude_type': props.get('magType'),
                'place': props.get('place'),
                'type': props.get('type'),
                'status': props.get('status'),
                'tsunami': props.get('tsunami'),
                'sig': props.get('sig'),
                'net': props.get('net'),
                'code': props.get('code'),
                'nst': props.get('nst'),
                'dmin': props.get('dmin'),
                'rms': props.get('rms'),
                'gap': props.get('gap'),
                'updated': datetime.fromtimestamp(props.get('updated', 0) / 1000) if props.get('updated') else None
            }
            
            earthquakes.append(earthquake)
        
        return earthquakes


class DatabaseManager:
    """Manages database operations for earthquake data"""
    
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.conn = None
        self.connect()
    
    def connect(self):
        """Establish database connection"""
        try:
            self.conn = psycopg2.connect(self.db_url)
            logger.info("Database connection established")
        except psycopg2.Error as e:
            logger.error(f"Database connection error: {e}")
            raise
    
    def insert_earthquakes(self, earthquakes: List[Dict[str, Any]]) -> int:
        """
        Insert earthquake records into database
        
        Args:
            earthquakes: List of earthquake records
        
        Returns:
            Number of records inserted
        """
        if not earthquakes:
            return 0
        
        inserted_count = 0
        cursor = self.conn.cursor()
        
        insert_query = """
            INSERT INTO earthquakes (
                id, time, latitude, longitude, depth, magnitude, magnitude_type,
                place, type, status, tsunami, sig, net, code, nst, dmin, rms, gap, updated
            ) VALUES (
                %(id)s, %(time)s, %(latitude)s, %(longitude)s, %(depth)s, %(magnitude)s,
                %(magnitude_type)s, %(place)s, %(type)s, %(status)s, %(tsunami)s,
                %(sig)s, %(net)s, %(code)s, %(nst)s, %(dmin)s, %(rms)s, %(gap)s, %(updated)s
            )
            ON CONFLICT (id) DO UPDATE SET
                updated = EXCLUDED.updated,
                status = EXCLUDED.status,
                magnitude = EXCLUDED.magnitude,
                updated_at = CURRENT_TIMESTAMP
        """
        
        try:
            for earthquake in earthquakes:
                try:
                    cursor.execute(insert_query, earthquake)
                    inserted_count += 1
                except psycopg2.Error as e:
                    logger.warning(f"Error inserting record {earthquake.get('id')}: {e}")
                    continue
            
            self.conn.commit()
            logger.info(f"Successfully inserted/updated {inserted_count} records")
            return inserted_count
        
        except psycopg2.Error as e:
            self.conn.rollback()
            logger.error(f"Database insertion error: {e}")
            return 0
        finally:
            cursor.close()
    
    def get_latest_earthquake_time(self) -> datetime:
        """Get the timestamp of the latest earthquake in database"""
        cursor = self.conn.cursor()
        
        try:
            cursor.execute("SELECT MAX(time) FROM earthquakes")
            result = cursor.fetchone()
            
            if result and result[0]:
                return result[0]
            else:
                # If no data, return 30 days ago
                return datetime.utcnow() - timedelta(days=30)
        
        except psycopg2.Error as e:
            logger.error(f"Error getting latest earthquake time: {e}")
            return datetime.utcnow() - timedelta(days=30)
        finally:
            cursor.close()
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")


class DataIngestionService:
    """Main service for ingesting earthquake data"""
    
    def __init__(self):
        self.api_url = os.getenv('USGS_API_URL', 'https://earthquake.usgs.gov/fdsnws/event/1/query')
        self.db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres123@localhost:5432/earthquake_db')
        self.fetch_interval = int(os.getenv('FETCH_INTERVAL', 300))  # 5 minutes
        
        self.fetcher = USGSDataFetcher(self.api_url)
        self.db_manager = DatabaseManager(self.db_url)
    
    def initial_load(self):
        """Load initial historical data (30 days)"""
        logger.info("Starting initial data load...")
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=30)
        
        earthquakes = self.fetcher.fetch_earthquakes(start_time, end_time)
        count = self.db_manager.insert_earthquakes(earthquakes)
        
        logger.info(f"Initial load complete: {count} records loaded")
    
    def incremental_update(self):
        """Fetch and insert new earthquake data since last update"""
        logger.info("Starting incremental update...")
        
        # Get the time of the latest earthquake in database
        start_time = self.db_manager.get_latest_earthquake_time()
        end_time = datetime.utcnow()
        
        # Fetch new data
        earthquakes = self.fetcher.fetch_earthquakes(start_time, end_time)
        count = self.db_manager.insert_earthquakes(earthquakes)
        
        logger.info(f"Incremental update complete: {count} records updated")
    
    def run(self):
        """Run the data ingestion service"""
        logger.info("Data Ingestion Service starting...")
        
        # Initial load
        try:
            self.initial_load()
        except Exception as e:
            logger.error(f"Initial load failed: {e}")
        
        # Schedule incremental updates
        schedule.every(self.fetch_interval).seconds.do(self.incremental_update)
        
        logger.info(f"Scheduled incremental updates every {self.fetch_interval} seconds")
        
        # Keep the service running
        while True:
            try:
                schedule.run_pending()
                time.sleep(1)
            except KeyboardInterrupt:
                logger.info("Service stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in service loop: {e}")
                time.sleep(60)  # Wait before retrying
        
        self.db_manager.close()


if __name__ == '__main__':
    service = DataIngestionService()
    service.run()
