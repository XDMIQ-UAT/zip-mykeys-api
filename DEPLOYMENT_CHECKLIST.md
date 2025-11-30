# MyKeys API Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Quality
- [x] Server syntax validated (`node -c server.js` passed)
- [x] All dependencies installed (`npm install` completed)
- [x] No syntax errors in server.js
- [x] Unified backend code consolidated

### ✅ Files Present
- [x] `server.js` - Main application server
- [x] `package.json` - Dependencies configured
- [x] `package-lock.json` - Lock file present
- [x] `Dockerfile` - Container configuration
- [x] `public/index.html` - Web UI
- [x] `setup-vm.sh` - VM setup script
- [x] `*.conf` - Nginx configurations (5 files)
- [x] `README.md` - Documentation
- [x] `MIGRATION.md` - Migration guide

### ⚠️ Configuration Files Needed

#### Environment Variables
The following environment variables should be set for production:

**Required:**
- `GCP_PROJECT` - GCP project ID (default: `myl-zip-www`)
- `PORT` - Server port (default: `8080`)

**Authentication (Optional - has defaults):**
- `MYKEYS_USER` - Basic auth username (default: `admin`)
- `MYKEYS_PASS` - Basic auth password (default: `XRi6TgSrwfeuK8taYzhknoJc`)

**Optional Passthrough:**
- `ENABLE_PASSTHROUGH` - Enable passthrough fallback (default: `false`)
- `API_MYL_ZIP_BASE` - Upstream API URL (default: `https://api.myl.zip`)
- `INTERNAL_API_KEY` - Internal API key (has default)

**Encryption (Optional):**
- `MASTER_KEY` - Master encryption key (auto-generated if not set)

#### GCP Service Account
- [ ] Service account with Secret Manager permissions configured
- [ ] Service account key file available (if needed)
- [ ] GCP Secret Manager API enabled

### ⚠️ Missing Files to Create

1. **`.gitignore`** - Should exclude:
   - `node_modules/`
   - `.env`
   - `*.log`
   - `.DS_Store`

2. **`.env.example`** - Template for environment variables:
   ```bash
   GCP_PROJECT=myl-zip-www
   PORT=8080
   MYKEYS_USER=admin
   MYKEYS_PASS=your-password-here
   ENABLE_PASSTHROUGH=false
   ```

3. **`.dockerignore`** - Optimize Docker builds:
   ```
   node_modules
   .git
   .env
   *.log
   .DS_Store
   README.md
   MIGRATION.md
   MYKEYS_FILES_SCAN.md
   ```

## Deployment Options

### Option 1: Google Cloud Run

**Prerequisites:**
- [ ] `gcloud` CLI installed and authenticated
- [ ] GCP project `myl-zip-www` exists
- [ ] Cloud Run API enabled
- [ ] Service account with Secret Manager permissions

**Deploy:**
```bash
cd E:\zip-myl-mykeys-api
npm run deploy
```

**Or manually:**
```bash
gcloud run deploy mykeys-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT=myl-zip-www,PORT=8080
```

### Option 2: VM Deployment (mykeys-vm)

**Prerequisites:**
- [ ] VM `mykeys-vm` exists in zone `us-central1-a`
- [ ] SSH access configured
- [ ] GCP service account attached to VM
- [ ] Nginx installed (via setup-vm.sh)

**Deploy:**
```bash
# Upload files
gcloud compute scp --recurse E:\zip-myl-mykeys-api mykeys-vm:/var/www/mykeys --zone=us-central1-a

# SSH into VM
gcloud compute ssh mykeys-vm --zone=us-central1-a

# On VM:
cd /var/www/mykeys
npm install --production
pm2 start server.js --name mykeys
pm2 save

# Configure Nginx
sudo cp mykeys.conf /etc/nginx/sites-available/mykeys
sudo ln -s /etc/nginx/sites-available/mykeys /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Option 3: Docker Container

**Build:**
```bash
cd E:\zip-myl-mykeys-api
docker build -t mykeys-api:2.0.0 .
```

**Run:**
```bash
docker run -d \
  -p 8080:8080 \
  -e GCP_PROJECT=myl-zip-www \
  -e PORT=8080 \
  --name mykeys-api \
  mykeys-api:2.0.0
```

## Post-Deployment Verification

### Health Checks
```bash
# Basic health
curl http://localhost:8080/health

# API health
curl http://localhost:8080/api/health

# V1 health
curl http://localhost:8080/api/v1/health
```

### Authentication Test
```bash
# Basic Auth
curl -u admin:XRi6TgSrwfeuK8taYzhknoJc http://localhost:8080/api/health

# Bearer Token
curl -H "Authorization: Bearer your-token-here" http://localhost:8080/api/v1/health
```

### Secret Management Test
```bash
# List secrets (requires auth)
curl -u admin:XRi6TgSrwfeuK8taYzhknoJc http://localhost:8080/api/secrets

# Get secret (requires auth)
curl -u admin:XRi6TgSrwfeuK8taYzhknoJc http://localhost:8080/api/secrets/secret-name
```

### Web UI Test
- [ ] Navigate to `http://localhost:8080` (or production URL)
- [ ] Verify web interface loads
- [ ] Test creating a secret via UI
- [ ] Test viewing secrets via UI

## Known Issues / Notes

1. **Axios Dependency**: The passthrough feature uses `axios` but it's conditionally required. This is fine as axios is in dependencies.

2. **GCP Authentication**: The service uses Application Default Credentials (ADC). Ensure:
   - Service account is attached to VM/Cloud Run
   - Service account has `roles/secretmanager.secretAccessor` role
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

3. **Port Configuration**: Default port is 8080, which matches Dockerfile and Cloud Run expectations.

4. **Public Directory**: Web UI is served from `/public` directory. Ensure it's included in Docker builds.

## Rollback Plan

If deployment fails:
1. Original passthrough service: `server-passthrough.js.backup`
2. Original backend: `C:\Users\dash\projects\myl\secrets-manager\`
3. Can restore from backup or redeploy previous version

## Status

**Current Status:** ✅ **READY FOR DEPLOYMENT**

**Remaining Tasks:**
- [ ] Create `.gitignore` file
- [ ] Create `.env.example` file
- [ ] Create `.dockerignore` file (optional optimization)
- [ ] Verify GCP service account permissions
- [ ] Choose deployment method and execute

**Code Status:** ✅ All code is ready
**Dependencies:** ✅ All installed
**Documentation:** ✅ Complete







