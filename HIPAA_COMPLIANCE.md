# HIPAA Compliance with Separate Databases

## Strategy: Separate Databases per Environment

For HIPAA compliance, using **separate databases** for each environment is the right approach:

- **Development**: `upstash-kv-dev` (or similar)
- **Preview**: `upstash-kv-preview` (or similar)  
- **Production**: `upstash-kv-prod` (or `upstash-kv-indigo-island`)

## Benefits

1. **Data Isolation**: Each environment has its own data
2. **Access Control**: Different credentials per environment
3. **Audit Trail**: Clear separation of production vs test data
4. **Compliance**: Meets HIPAA requirements for data segregation

## Setup

### 1. Create Separate Databases in Upstash
- One for Development
- One for Preview
- One for Production

### 2. Set Environment Variables in Vercel

**For Production:**
```
UPSTASH_REDIS_REST_URL=<production-db-url>
UPSTASH_REDIS_REST_TOKEN=<production-db-token>
```

**For Preview:**
```
UPSTASH_REDIS_REST_URL=<preview-db-url>
UPSTASH_REDIS_REST_TOKEN=<preview-db-token>
```

**For Development:**
```
UPSTASH_REDIS_REST_URL=<dev-db-url>
UPSTASH_REDIS_REST_TOKEN=<dev-db-token>
```

### 3. Store Credentials Separately

Each environment will have its own copy of:
- SES credentials
- Twilio credentials
- Other secrets

## Current Setup

Using `upstash-kv-indigo-island` for Production is correct. You can create separate databases for Dev/Preview later if needed.




