# Quick Start - API Documentation

## Access Swagger UI

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Open Swagger UI in your browser:**
   ```
   http://localhost:3000/api/docs
   ```

3. **Authenticate:**
   - Click the "Authorize" button (lock icon) at the top
   - Enter your JWT token: `Bearer <your_token>`
   - Click "Authorize"

4. **Test endpoints:**
   - Browse all available endpoints organized by tags
   - Click "Try it out" on any endpoint
   - Fill in parameters and request body
   - Click "Execute" to test

## Import into Postman

1. Open Postman
2. Click "Import"
3. Select "File" and choose `backend/openapi.json`
4. All endpoints will be imported as a collection
5. Set up environment variables:
   - `base_url`: `http://localhost:3000/api`
   - `token`: Your JWT access token

## Documentation Features

✅ **191 API Endpoints** - All routes automatically documented
✅ **Interactive Testing** - Test endpoints directly in Swagger UI
✅ **Request/Response Examples** - See example payloads
✅ **Authentication Support** - Test with JWT tokens
✅ **Schema Validation** - View data models and validation rules
✅ **Error Responses** - See all possible error codes

## Endpoint Categories

- **Authentication** - User management and auth
- **Habits** - Habit tracking and management  
- **Journeys** - 21-day journey system
- **Progress** - Task completion and tracking
- **Analytics** - Insights and metrics
- **AI Services** - AI-powered features
- **Coach** - AI coach sessions
- **Buddies** - Social features
- **Rewards** - Points and badges
- **Settings** - User preferences
- **Admin** - System administration

## Need Help?

- See `docs/README.md` for detailed documentation
- Check `openapi.json` for the complete API specification
- All endpoints follow RESTful conventions
- Standard response format: `{ success: boolean, data?: any, error?: string }`
