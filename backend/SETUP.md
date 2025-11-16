# UnHabit Backend - Supabase Auth Setup Guide

## 🎯 Quick Setup (5 minutes)

### 1. Get Supabase Credentials

1. Go to your Supabase project: https://app.supabase.com
2. Go to **Settings** → **API**
3. Copy the following:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (⚠️ Keep this secret!)
4. Go to **Settings** → **API** → **JWT Settings**
5. Copy the **JWT Secret**

### 2. Configure Environment

```bash
cd backend
cp env.example .env
```

Edit `.env` and add your credentials:

```env
# From Supabase > Settings > Database > Connection string > URI
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].supabase.com:5432/postgres"

# From Supabase > Settings > API
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJI..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJI..."

# From Supabase > Settings > API > JWT Settings
JWT_SECRET="your-super-secret-jwt-token-with-at-least-32-characters-long"

# Your frontend URL
FRONTEND_URL="http://localhost:5173"
```

### 3. Install & Generate

```bash
npm install
npx prisma generate
```

### 4. Start Server

```bash
npm run dev
```

Server will run at: http://localhost:3000

### 5. Test It Works

```bash
curl http://localhost:3000/healthz
# Should return: {"ok":true}
```

---

## 📱 Enable Email Auth in Supabase

1. Go to **Authentication** → **Providers**
2. Make sure **Email** is enabled
3. Configure **Email Templates** (optional but recommended):
   - Go to **Authentication** → **Email Templates**
   - Customize confirmation and reset password emails
   - Set redirect URLs to your frontend

---

## 🔐 Enable OAuth Providers (Optional)

### Google OAuth

1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Follow Supabase instructions to:
   - Create Google OAuth app
   - Add client ID and secret
4. Frontend code:
   ```typescript
   await supabase.auth.signInWithOAuth({ provider: 'google' })
   ```

### GitHub OAuth

1. Enable **GitHub** provider
2. Create GitHub OAuth app
3. Add credentials to Supabase

---

## 📊 Database Schema

Your Prisma schema is already synced with Supabase. Key tables:

- `auth.users` - Supabase managed user accounts
- `public.profiles` - Your custom user profile data
- Other tables from your schema

The backend automatically syncs `auth.users` with `public.profiles`.

---

## 🧪 Test Authentication Flow

### 1. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Copy the `access_token` from the response.

### 3. Get Profile

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🎨 Frontend Integration

### Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Create Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### Sign Up

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
})
```

### Sign In

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})
```

### Call Backend APIs

```typescript
const { data: { session } } = await supabase.auth.getSession()

const response = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
})
```

---

## 🛠️ Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Pull schema from Supabase
npx prisma db pull
```

---

## 🚨 Troubleshooting

### "Invalid JWT"
- Check `JWT_SECRET` matches Supabase
- Verify token is not expired
- Make sure you're using Bearer token format

### "User not found"
- Profile may not be synced. Register user through backend API first
- Check Supabase Dashboard → Authentication → Users

### "Connection refused"
- Check `DATABASE_URL` and `DIRECT_URL` are correct
- Verify Supabase project is running
- Check firewall settings

### Prisma errors
- Run `npx prisma generate` after any schema changes
- For connection errors, use `DIRECT_URL` for migrations

---

## 📖 Full Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

---

## ✅ Production Checklist

Before deploying:

- [ ] Add all environment variables to production
- [ ] Set `NODE_ENV=production`
- [ ] Update `CORS_ORIGIN` with production frontend URL
- [ ] Update `FRONTEND_URL` for email redirects
- [ ] Enable RLS policies in Supabase
- [ ] Set up Supabase email provider (SendGrid, etc.)
- [ ] Test OAuth redirects with production URLs
- [ ] Enable Supabase 2FA (optional but recommended)

