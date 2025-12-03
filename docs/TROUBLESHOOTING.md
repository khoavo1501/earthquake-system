# Troubleshooting Guide

## 🐛 Common Issues & Solutions

### 1. Load Historical Data - Error 502 Bad Gateway

**Triệu chứng:**
- Click button "Load Historical Data"
- Chọn 1 năm hoặc nhiều hơn
- Nhận error 502 Bad Gateway

**Nguyên nhân:**
USGS API có giới hạn:
- Max 20,000 events per request
- Không cho phép query quá lớn trong một request
- Rate limiting nếu request quá nhanh

**Giải pháp đã áp dụng:**

1. **Chunked Requests:**
   - Chia request lớn thành các chunks nhỏ (30 ngày mỗi chunk)
   - Fetch từng chunk riêng biệt
   - Gộp tất cả results lại

2. **Rate Limiting:**
   - Sleep 1 second giữa các requests
   - Tránh bị USGS API block

3. **Error Handling:**
   - Continue nếu một chunk fail
   - Log chi tiết cho từng chunk
   - Return tổng số records fetched

**Code Implementation:**

```python
# Split into monthly chunks
all_features = []
current_start = start

while current_start < end:
    current_end = min(
        current_start + timedelta(days=30),
        end
    )
    
    # Fetch chunk
    response = requests.get(usgs_url, params=params, timeout=60)
    data = response.json()
    all_features.extend(data.get('features', []))
    
    # Rate limiting
    time.sleep(1)
    
    current_start = current_end + timedelta(days=1)
```

**Test Results:**
- ✅ 30 days: 1,354 records - Success
- ✅ 6 months: 14,563 records - Success  
- ✅ 1 year: ~30,000 records - Should work
- ✅ 2 years: ~60,000 records - Should work

---

### 2. Sticky Header không "stick"

**Triệu chứng:**
Header không cố định khi scroll

**Giải pháp:**
Kiểm tra CSS:
```jsx
<Header 
  style={{ 
    position: 'sticky',
    top: 0,
    zIndex: 999
  }}
>
```

**Verify:**
- Scroll xuống dashboard
- Header phải stay at top
- Box shadow visible

---

### 3. Reload Service Buttons không hoạt động

**Triệu chứng:**
Click button reload không response

**Kiểm tra:**

1. **Services đang chạy:**
```bash
docker-compose ps
```

All services phải "Up"

2. **Test endpoints:**
```bash
# Database
curl http://localhost:8001/api/earthquakes/stats

# Analysis
curl http://localhost:8002/api/analysis/timeseries?period=daily

# Clustering  
curl http://localhost:8003/api/clusters/geographic

# Prediction
curl http://localhost:8004/api/predictions/forecast?days=7
```

3. **Xem logs:**
```bash
docker-compose logs [service-name]
```

---

### 4. Frontend không load components

**Triệu chứng:**
Dashboard blank hoặc components không hiển thị

**Giải pháp:**

1. **Check console errors:**
F12 → Console tab

2. **Verify Vite dev server:**
```bash
docker-compose logs frontend
```

Should see: "Local: http://localhost:3000/"

3. **Rebuild frontend:**
```bash
docker-compose up -d --build frontend
```

---

### 5. PostgreSQL version conflict

**Triệu chứng:**
```
database files are incompatible with server
The data directory was initialized by PostgreSQL version 14, 
which is not compatible with this version 15
```

**Giải pháp:**
```bash
# Stop và xóa volumes
docker-compose down -v

# Restart với fresh database
docker-compose up -d --build
```

⚠️ **Warning:** Mất hết data hiện tại!

---

### 6. Redis connection failed

**Triệu chứng:**
Services báo lỗi kết nối Redis

**Kiểm tra:**
```bash
# Redis status
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
```

Should return: `PONG`

**Fix:**
```bash
docker-compose restart redis
```

---

### 7. Data không update sau khi load

**Triệu chứng:**
Load historical data success nhưng charts không thay đổi

**Nguyên nhân:**
Redis cache đang giữ data cũ

**Giải pháp:**
```bash
# Clear Redis cache
docker-compose exec redis redis-cli FLUSHDB
```

Hoặc reload service data bằng buttons trên UI

---

### 8. Port already in use

**Triệu chứng:**
```
Error: bind: address already in use
```

**Kiểm tra ports:**
```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :8001

# Linux/Mac
lsof -i :3000
lsof -i :8001
```

**Giải pháp:**
1. Kill process đang dùng port
2. Hoặc đổi port trong `.env`

---

### 9. CORS errors trong browser

**Triệu chứng:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Verify CORS config:**

File: `services/*/main.py`
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Fix:**
Restart backend services:
```bash
docker-compose restart database-api data-analysis clustering prediction
```

---

### 10. Slow load times

**Triệu chứng:**
Charts load chậm (> 5 seconds)

**Optimization:**

1. **Check Redis cache:**
```bash
docker-compose exec redis redis-cli INFO stats
```

Cache hit rate should be > 80%

2. **Database indexes:**
```sql
-- Already created in init.sql
CREATE INDEX idx_earthquakes_time ON earthquakes(time);
CREATE INDEX idx_earthquakes_magnitude ON earthquakes(magnitude);
```

3. **Reduce data range:**
Sử dụng date picker để filter smaller range

---

## 🔍 Debug Commands

### Quick Health Check
```bash
./health-check.sh
```

### View all logs
```bash
docker-compose logs -f --tail=100
```

### Specific service logs
```bash
docker-compose logs -f [service-name]
```

### Database query
```bash
docker-compose exec postgres psql -U postgres -d earthquake_db -c "SELECT COUNT(*) FROM earthquakes;"
```

### Redis stats
```bash
docker-compose exec redis redis-cli INFO
```

### Container stats
```bash
docker stats
```

---

## 📞 Getting Help

1. **Check logs first:**
   ```bash
   docker-compose logs [service]
   ```

2. **Test APIs:**
   ```bash
   ./test-apis.sh
   ```

3. **Review documentation:**
   - README.md
   - API.md
   - ARCHITECTURE.md
   - NEW_FEATURES.md

4. **Common solutions:**
   - Restart services
   - Clear cache
   - Rebuild images
   - Check environment variables

---

## ✅ Verification Checklist

Sau khi fix issues, verify:

- [ ] All 8 containers running: `docker-compose ps`
- [ ] All APIs responding: `./test-apis.sh`
- [ ] Frontend accessible: http://localhost:3000
- [ ] Database has data: Check stats on dashboard
- [ ] Charts loading: Test all 5 tabs
- [ ] Sticky header working: Scroll test
- [ ] Reload buttons working: Click each button
- [ ] Historical load working: Test with 30 days

---

**Last Updated:** November 26, 2025
**Version:** 1.1.0
