# Deployment Guide

## Prerequisites

### System Requirements
- **OS**: Linux (Ubuntu 20.04+), macOS, Windows with WSL2
- **RAM**: Minimum 8GB, Recommended 16GB
- **Storage**: 10GB free space
- **CPU**: 2+ cores recommended

### Software Requirements
- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

## Installation Steps

### 1. Install Docker

#### Ubuntu/Debian
```bash
# Update package index
sudo apt-get update

# Install dependencies
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

#### macOS
```bash
# Download and install Docker Desktop from:
# https://www.docker.com/products/docker-desktop
```

#### Windows
```bash
# Install WSL2 first
wsl --install

# Download and install Docker Desktop from:
# https://www.docker.com/products/docker-desktop
```

### 2. Clone Repository

```bash
git clone <your-repository-url>
cd earthquake-system
```

### 3. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env file if needed
nano .env
```

### 4. Build and Start Services

```bash
# Build all containers
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 5. Verify Installation

```bash
# Check if all services are running
docker-compose ps

# Test Database API
curl http://localhost:8001/

# Test Analysis API
curl http://localhost:8002/

# Test Clustering API
curl http://localhost:8003/

# Test Prediction API
curl http://localhost:8004/

# Open Frontend
# http://localhost:3000
```

## Service Management

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f database-api
docker-compose logs -f data-ingestion
```

### Rebuild Services
```bash
# Rebuild all
docker-compose build --no-cache

# Rebuild specific service
docker-compose build --no-cache database-api
```

## Database Management

### Access PostgreSQL
```bash
docker-compose exec postgres psql -U postgres -d earthquake_db
```

### Backup Database
```bash
docker-compose exec postgres pg_dump -U postgres earthquake_db > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres earthquake_db
```

### Reset Database
```bash
docker-compose down -v
docker-compose up -d
```

## Monitoring

### Check Container Resources
```bash
docker stats
```

### Check Logs
```bash
# Real-time logs
docker-compose logs -f --tail=100

# Service-specific logs
docker-compose logs -f data-ingestion
```

### Health Checks
```bash
# Check all services
curl http://localhost:8001/
curl http://localhost:8002/
curl http://localhost:8003/
curl http://localhost:8004/
```

## Troubleshooting

### Services Won't Start

**Problem**: Port already in use
```bash
# Find process using port
lsof -ti:3000
lsof -ti:8001

# Kill process
kill -9 <PID>
```

**Problem**: Database connection error
```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres

# Wait for database to be ready
docker-compose exec postgres pg_isready
```

### Performance Issues

**Problem**: Slow response times
```bash
# Check Redis cache
docker-compose exec redis redis-cli ping

# Monitor resource usage
docker stats

# Increase container resources in docker-compose.yml
```

### Data Not Loading

**Problem**: No data from USGS API
```bash
# Check data ingestion logs
docker-compose logs data-ingestion

# Manually trigger ingestion
curl -X POST http://localhost:8001/api/analysis/run

# Test USGS API directly
curl "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2024-01-01&endtime=2024-01-02"
```

## Production Deployment

### Security Hardening

1. **Change Default Passwords**
```bash
# Edit .env file
POSTGRES_PASSWORD=<strong-password>
```

2. **Enable SSL/TLS**
```bash
# Add SSL certificates
# Update nginx configuration
```

3. **Set up Firewall**
```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Performance Optimization

1. **Increase Database Resources**
```yaml
# docker-compose.yml
postgres:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 4G
```

2. **Configure Redis Memory**
```yaml
redis:
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

3. **Enable Production Mode**
```bash
# Frontend
NODE_ENV=production

# Backend
FASTAPI_ENV=production
```

### Cloud Deployment

#### AWS EC2

```bash
# Launch EC2 instance (Ubuntu 20.04, t2.large)
# Install Docker
# Clone repository
# Start services

# Configure Security Group
# Inbound: 80, 443, 8001-8004
```

#### Google Cloud Platform

```bash
# Create Compute Engine instance
# Install Docker
# Clone repository
# Start services

# Configure Firewall Rules
gcloud compute firewall-rules create allow-earthquake-system \
  --allow tcp:80,tcp:443,tcp:8001-8004
```

#### DigitalOcean

```bash
# Create Droplet (Ubuntu 20.04, 8GB RAM)
# Install Docker
# Clone repository
# Start services
```

### Kubernetes Deployment (Advanced)

```yaml
# Create Kubernetes manifests
kubectl apply -f k8s/

# Services:
# - deployments/
# - services/
# - configmaps/
# - secrets/
# - ingress/
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
database-api:
  deploy:
    replicas: 3
```

### Load Balancing

```yaml
# Add nginx reverse proxy
nginx:
  image: nginx:alpine
  ports:
    - "80:80"
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf
```

## Backup Strategy

### Automated Backups

```bash
# Cron job for daily backup
0 2 * * * docker-compose exec postgres pg_dump -U postgres earthquake_db > /backups/earthquake_$(date +\%Y\%m\%d).sql
```

### Backup to Cloud

```bash
# AWS S3
aws s3 cp backup.sql s3://my-bucket/backups/

# Google Cloud Storage
gsutil cp backup.sql gs://my-bucket/backups/
```

## Monitoring & Alerting

### Prometheus + Grafana

```yaml
# Add to docker-compose.yml
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana
  ports:
    - "3001:3000"
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

```yaml
elasticsearch:
  image: elasticsearch:8.11.0
  
logstash:
  image: logstash:8.11.0
  
kibana:
  image: kibana:8.11.0
```

## Maintenance

### Update Services

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d
```

### Clean Up

```bash
# Remove unused containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove unused volumes
docker volume prune -f

# Remove everything
docker system prune -a -f
```

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify configuration: `.env` file
3. Check network: `docker network ls`
4. Inspect container: `docker inspect <container-name>`

## Useful Commands

```bash
# Enter container shell
docker-compose exec database-api bash

# Copy files from container
docker cp <container>:/path/to/file /local/path

# View container environment
docker-compose exec database-api env

# Inspect network
docker network inspect earthquake-system_earthquake-network
```
