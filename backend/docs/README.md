# UnHabit Backend API Documentation

## Overview

This directory contains comprehensive API documentation for the UnHabit backend service. The documentation is automatically generated from the route files and provides a complete reference for all API endpoints.

## Accessing the Documentation

### Swagger UI (Interactive Documentation)

Once the server is running, access the interactive Swagger documentation at:

```
http://localhost:3000/api/docs
```

This provides:
- **Interactive API Explorer**: Test endpoints directly from the browser
- **Request/Response Examples**: See example payloads and responses
- **Authentication**: Test with JWT tokens
- **Schema Definitions**: View data models and validation rules

### OpenAPI Specification

The complete OpenAPI 3.0 specification is available at:

```
backend/openapi.json
```

This file can be:
- Imported into Postman
- Used with API testing tools
- Shared with frontend developers
- Used for code generation

## Documentation Structure

The API is organized into the following sections:

### Core Features
- **Authentication** (`/api/auth`) - User registration, login, profile management
- **Habits** (`/api/habits`) - Habit creation, tracking, and management
- **Journeys** (`/api/journeys`) - 21-day journey management
- **Progress** (`/api/progress`) - Task completion, reflections, slip tracking
- **Analytics** (`/api/analytics`) - Insights, metrics, and data export

### AI & Coaching
- **AI Services** (`/api/ai`) - AI-powered features (onboarding, planning, coaching)
- **AI Diagnostics** (`/api/ai-diagnostics`) - Diagnostic data storage
- **Coach** (`/api/coach`) - AI coach chat sessions

### Social & Engagement
- **Buddies** (`/api/buddies`) - Social features, buddy system, check-ins
- **Leaderboard** (`/api/leaderboard`) - Rankings and competitions
- **Challenges** (`/api/challenges`) - Daily challenges

### User Experience
- **Home** (`/api/home`) - Dashboard data
- **Streaks** (`/api/streaks`) - Streak tracking and management
- **Rewards** (`/api/rewards`) - Points, badges, and rewards
- **Notifications** (`/api/notifications`) - Notification preferences
- **Settings** (`/api/settings`) - User settings and preferences
- **Focus** (`/api/focus`) - Focus timer sessions
- **Recovery** (`/api/recovery`) - Recovery options after missed days
- **Share** (`/api/share`) - Sharing features

### Administration
- **Admin** (`/api/admin`) - Admin-only endpoints for system management

## Authentication

Most endpoints require authentication using a JWT Bearer token:

```
Authorization: Bearer <your_jwt_token>
```

To get a token:
1. Register a new user: `POST /api/auth/register`
2. Login: `POST /api/auth/login`
3. Use the `access_token` from the response

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
- `502` - Bad Gateway (external service unavailable)

## Testing the API

### Using Swagger UI

1. Start the server: `npm run dev`
2. Navigate to `http://localhost:3000/api/docs`
3. Click "Authorize" and enter your JWT token
4. Explore and test endpoints directly in the browser

### Using Postman

1. Import `openapi.json` into Postman
2. Set up environment variables:
   - `base_url`: `http://localhost:3000/api`
   - `token`: Your JWT access token
3. Use the imported collection to test endpoints

### Using cURL

```bash
# Example: Get user habits
curl -X GET http://localhost:3000/api/habits \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Documentation Updates

The OpenAPI specification is automatically generated from route files. The documentation reflects the current state of the codebase and includes:

- All endpoint paths and HTTP methods
- Request/response schemas
- Authentication requirements
- Parameter descriptions
- Error responses

## For Developers

### Architecture

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL (via Prisma ORM)
- **Authentication**: Supabase Auth (JWT)
- **Validation**: Zod schemas
- **Documentation**: OpenAPI 3.0 / Swagger

### Key Files

- `src/routes/` - Route definitions
- `src/services/` - Business logic
- `src/middlewares/` - Authentication and error handling
- `openapi.json` - Generated API specification
- `src/docs/swagger.ts` - Swagger UI configuration

## Support

For questions or issues with the API, please refer to the codebase or contact the development team.
