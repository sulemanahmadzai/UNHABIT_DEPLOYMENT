# UnHabit Backend API Documentation

## Authentication with Supabase

This API uses **Supabase Authentication**. The backend validates JWT tokens issued by Supabase.

### Base URL

```
http://localhost:3000/api
```

## 🔐 Authentication Flow

### Frontend Setup (Recommended)

For the **best experience**, handle authentication **directly in the frontend** using `@supabase/supabase-js`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient("YOUR_SUPABASE_URL", "YOUR_SUPABASE_ANON_KEY");

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password123",
  options: {
    data: {
      full_name: "John Doe",
    },
  },
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password123",
});

// Get session
const {
  data: { session },
} = await supabase.auth.getSession();
const accessToken = session?.access_token;

// Sign out
await supabase.auth.signOut();
```

### Making Authenticated Requests

Include the Supabase access token in the Authorization header:

```typescript
const response = await fetch("http://localhost:3000/api/auth/me", {
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  },
});
```

---

## 📋 API Endpoints

### Authentication Endpoints

#### 1. POST /api/auth/register

Register a new user (backend proxy - frontend should use Supabase directly)

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe" // optional
}
```

**Response (201):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "User registered successfully. Please check email for verification."
}
```

---

#### 2. POST /api/auth/login

Login with email/password (backend proxy - frontend should use Supabase directly)

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_here",
  "expires_in": 3600
}
```

---

#### 3. POST /api/auth/verify-email

Verify email with OTP token

**Request:**

```json
{
  "email": "user@example.com",
  "token": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "user": {
    /* user object */
  },
  "session": {
    /* session object */
  }
}
```

---

#### 4. POST /api/auth/forgot-password

Send password reset email

**Request:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password reset email sent if account exists"
}
```

---

#### 5. POST /api/auth/reset-password

Reset password (requires authentication)

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "new_password": "newpassword123"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Password updated successfully"
}
```

---

#### 6. GET /api/auth/me

Get current user profile

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-01T00:00:00Z",
    "last_sign_in_at": "2024-01-01T00:00:00Z"
  },
  "profile": {
    "userId": "uuid",
    "fullName": "John Doe",
    "avatarUrl": "https://...",
    "timezone": "America/New_York",
    "locale": "en",
    "onboarded": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

#### 7. PUT /api/auth/profile

Update user profile

**Headers:**

```
Authorization: Bearer <access_token>
```

**Request:**

```json
{
  "full_name": "Jane Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "timezone": "America/Los_Angeles",
  "locale": "es"
}
```

_All fields are optional_

**Response (200):**

```json
{
  "success": true,
  "profile": {
    "userId": "uuid",
    "fullName": "Jane Doe",
    "avatarUrl": "https://example.com/avatar.jpg",
    "timezone": "America/Los_Angeles",
    "locale": "es",
    "onboarded": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z"
  }
}
```

---

#### 8. POST /api/auth/onboarded

Mark user as onboarded (complete onboarding flow)

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "profile": {
    "userId": "uuid",
    "fullName": "John Doe",
    "onboarded": true
    // ... other profile fields
  }
}
```

---

#### 9. DELETE /api/auth/account

Delete user account

**Headers:**

```
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## 🚨 Error Responses

### 400 Bad Request

Invalid input data

```json
{
  "error": "Validation error",
  "message": "Email is required"
}
```

### 401 Unauthorized

Missing or invalid token

```json
{
  "error": "Missing authorization header",
  "message": "Authorization header with Bearer token is required"
}
```

```json
{
  "error": "Invalid or expired token",
  "message": "Token validation failed"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "message": "Something went wrong"
}
```

---

## 🔧 Environment Variables

Create a `.env` file with these variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database URLs
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# JWT Secret (from Supabase)
JWT_SECRET=your-jwt-secret

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Frontend URL (for email redirects)
FRONTEND_URL=http://localhost:5173
```

---

## 📦 Frontend Integration Example

### React/Next.js Example

```typescript
// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// hooks/useAuth.ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}

// api/client.ts
import { supabase } from "@/lib/supabase";

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`http://localhost:3000/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token && {
        Authorization: `Bearer ${session.access_token}`,
      }),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }

  return data;
}

// Usage in components
function ProfilePage() {
  const { session } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (session) {
      apiClient("/auth/me")
        .then((data) => setProfile(data.profile))
        .catch(console.error);
    }
  }, [session]);

  if (!profile) return <div>Loading...</div>;

  return (
    <div>
      <h1>{profile.fullName}</h1>
      <p>{session.user.email}</p>
    </div>
  );
}
```

---

## 🎯 Supabase Features Available

### 1. OAuth Providers

Enable in Supabase Dashboard, then use in frontend:

```typescript
await supabase.auth.signInWithOAuth({
  provider: "google", // or 'github', 'facebook', etc.
});
```

### 2. Magic Link (Passwordless)

```typescript
await supabase.auth.signInWithOtp({
  email: "user@example.com",
});
```

### 3. Phone Authentication

```typescript
await supabase.auth.signInWithOtp({
  phone: "+1234567890",
});
```

### 4. Storage

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from("avatars")
  .upload("user-id/avatar.jpg", file);

// Get public URL
const { data } = supabase.storage
  .from("avatars")
  .getPublicUrl("user-id/avatar.jpg");
```

### 5. Real-time

```typescript
// Subscribe to database changes
const channel = supabase
  .channel("room-1")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => console.log("New message:", payload)
  )
  .subscribe();
```

---

## 🧪 Testing the API

### Using cURL

**Register:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","full_name":"Test User"}'
```

**Login:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Get Profile (with token):**

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🚀 Getting Started

1. **Install dependencies:**

   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**

   ```bash
   cp env.example .env
   # Edit .env with your Supabase credentials
   ```

3. **Run Prisma migrations:**

   ```bash
   npx prisma generate
   npx prisma db pull  # Pull existing schema from Supabase
   ```

4. **Start the server:**

   ```bash
   npm run dev
   ```

5. **Test the health endpoint:**
   ```bash
   curl http://localhost:3000/healthz
   ```

---

## 📝 Notes

- **RLS (Row Level Security)**: Enabled on Supabase tables. Backend uses service role key to bypass RLS.
- **Profile Sync**: Backend automatically syncs `auth.users` with `public.profiles` table.
- **Token Expiry**: Access tokens expire in 1 hour. Frontend should handle refresh automatically with Supabase client.
- **CORS**: Configure `CORS_ORIGIN` in `.env` to match your frontend URL.

---

## 🆘 Support

For issues or questions:

1. Check Supabase Dashboard for auth logs
2. Check backend logs for detailed errors
3. Verify environment variables are set correctly
4. Ensure Supabase project is properly configured
