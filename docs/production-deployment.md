# Production Deployment Guide

This guide covers deploying the Energy IC Copilot application to production environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for building)
- Python 3.11+ (for API)
- SSL certificate (recommended)

## Quick Start with Docker

### 1. Build and Run with Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd energy-ic-copilot

# Build and start all services
docker-compose up --build -d

# Check logs
docker-compose logs -f

# Access the application
# Web: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Copy template
cp .env.example .env

# Edit with your settings
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
API_PORT=8000
API_HOST=0.0.0.0
```

## Manual Deployment

### Backend (API)

```bash
cd apps/api

# Install dependencies
pip install -r requirements.txt

# Run with gunicorn for production
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Frontend (Web)

```bash
cd apps/web

# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start
```

## Cloud Deployment Options

### Vercel (Frontend) + Railway/Fly.io (Backend)

1. **Deploy Frontend to Vercel:**
   ```bash
   cd apps/web
   npx vercel --prod
   ```

2. **Deploy Backend to Railway:**
   ```bash
   cd apps/api
   railway login
   railway link
   railway up
   ```

### AWS Deployment

1. **EC2 Instance Setup:**
   ```bash
   # Install Docker
   sudo yum update -y
   sudo yum install docker -y
   sudo service docker start
   sudo usermod -a -G docker ec2-user

   # Install docker-compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **Deploy Application:**
   ```bash
   git clone <repository-url>
   cd energy-ic-copilot
   docker-compose up --build -d
   ```

3. **Configure Nginx (Optional):**
   ```bash
   sudo yum install nginx -y
   sudo systemctl start nginx
   ```

   Create `/etc/nginx/conf.d/energy-ic-copilot.conf`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }

       location /api {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

### DigitalOcean App Platform

1. **Create App Spec:**
   ```yaml
   name: energy-ic-copilot
   services:
   - name: api
     source_dir: apps/api
     github:
       repo: your-org/energy-ic-copilot
       branch: main
     run_command: python -m uvicorn main:app --host 0.0.0.0 --port $PORT
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: PYTHON_VERSION
       value: 3.11

   - name: web
     source_dir: apps/web
     github:
       repo: your-org/energy-ic-copilot
       branch: main
     build_command: npm run build
     run_command: npm start
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: NEXT_PUBLIC_API_URL
       value: ${api.PUBLIC_URL}
   ```

## SSL Configuration

### Let's Encrypt (with Certbot)

```bash
# Install certbot
sudo yum install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring & Maintenance

### Health Checks

The API provides health endpoints:
- `GET /health` - Overall system health
- `GET /` - API status

### Logs

```bash
# View application logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f web
```

### Backups

```bash
# Backup data directory
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Database backup (if using SQLite)
cp apps/api/app.db backup-$(date +%Y%m%d).db
```

## Performance Optimization

### API Optimization
- Use gunicorn with multiple workers
- Enable gzip compression
- Configure connection pooling

### Frontend Optimization
- Next.js automatic optimization enabled
- Static asset caching
- Image optimization with next/image

### Database Optimization
- Use connection pooling
- Implement query optimization
- Regular maintenance (VACUUM for SQLite)

## Security Considerations

- ✅ Environment variables for secrets
- ✅ No hardcoded credentials
- ✅ Input validation with Pydantic
- ✅ CORS properly configured
- ✅ HTTPS in production
- ✅ Regular dependency updates

## Troubleshooting

### Common Issues

1. **Port conflicts:** Change ports in docker-compose.yml
2. **Memory issues:** Increase Docker memory limits
3. **Build failures:** Clear Docker cache with `docker system prune`

### Debug Commands

```bash
# Check running containers
docker ps

# View container logs
docker logs <container-id>

# Access container shell
docker exec -it <container-id> /bin/bash

# Restart services
docker-compose restart
```

## Scaling

For high-traffic deployments:

1. **Horizontal scaling:** Increase service replicas
2. **Load balancer:** Use nginx or cloud load balancers
3. **Database:** Migrate from SQLite to PostgreSQL
4. **Caching:** Add Redis for session/API caching
5. **CDN:** Use CloudFlare or AWS CloudFront for assets

---

**🚀 Your Energy IC Copilot is now production-ready!**
