export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'MusicGPT API',
    version: '1.0.0',
    description: `
## MusicGPT Backend API

AI music creation platform backend. Users submit text prompts which are asynchronously processed to simulate audio generation.

### How to use this API

1. **Register** via \`POST /auth/register\` or **Login** via \`POST /auth/login\`
2. Copy the \`accessToken\` from the response
3. Click **Authorize** (top right) and paste the token
4. All authenticated endpoints will now include your Bearer token automatically

### Authentication

All protected endpoints require:
\`\`\`
Authorization: Bearer <accessToken>
\`\`\`

Access tokens expire after **15 minutes**. Use \`POST /auth/refresh\` with your \`refreshToken\` to get a new pair.

### Prompt Processing Lifecycle

\`\`\`
POST /prompts → PENDING → (cron every 10s) → PROCESSING → (worker 2-5s) → COMPLETED
\`\`\`

When a prompt completes, a WebSocket event is sent to the user's channel.

### Rate Limits

| Tier | Limit         |
|------|---------------|
| FREE | 20 req / min  |
| PAID | 100 req / min |

Headers returned on every authenticated request:
- \`X-RateLimit-Limit\` — your tier's limit
- \`X-RateLimit-Remaining\` — requests remaining in current window
    `,
    contact: {
      name: 'MusicGPT API Support',
    },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://lalas-production.up.railway.app', description: 'Production (Railway)' },
  ],
  tags: [
    {
      name: 'Auth',
      description: 'Registration, login, token refresh, and logout. All non-auth endpoints require a Bearer token obtained from these endpoints.',
    },
    {
      name: 'Subscription',
      description: 'Manage subscription tier. PAID users get higher rate limits and priority prompt processing.',
    },
    {
      name: 'Prompts',
      description: 'Submit text prompts for audio generation. Processing is asynchronous — poll the status or listen via WebSocket.',
    },
    {
      name: 'Audio',
      description: 'Access generated audio records. Audio is created automatically when a prompt completes processing.',
    },
    {
      name: 'Users',
      description: 'User profile management. All list endpoints are paginated (cursor-based) and Redis-cached.',
    },
    {
      name: 'Search',
      description: 'Unified search across users and audio with weighted ranking. Supports cursor-based pagination per resource type.',
    },
    {
      name: 'System',
      description: 'Health check and system endpoints.',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token obtained from /auth/login or /auth/register. Expires in 15 minutes.',
      },
    },
    schemas: {
      User: {
        type: 'object',
        description: 'A registered user of the platform.',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'a3f1c2d4-1234-4abc-8def-000000000001' },
          email: { type: 'string', format: 'email', example: 'jane@example.com' },
          display_name: { type: 'string', example: 'Jane Doe' },
          subscription_status: {
            type: 'string',
            enum: ['FREE', 'PAID'],
            description: 'Subscription tier. Affects rate limits and prompt queue priority.',
            example: 'FREE',
          },
          created_at: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:00.000Z' },
          updated_at: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:00.000Z' },
        },
      },
      Prompt: {
        type: 'object',
        description: 'A text prompt submitted by a user for audio generation.',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'b5e2d3f4-5678-4bcd-9ef0-000000000002' },
          user_id: { type: 'string', format: 'uuid', example: 'a3f1c2d4-1234-4abc-8def-000000000001' },
          text: { type: 'string', example: 'Upbeat jazz piano with a walking bass line, 120 BPM' },
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'COMPLETED'],
            description: 'PENDING = waiting for cron, PROCESSING = worker is running, COMPLETED = audio ready',
            example: 'PENDING',
          },
          created_at: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:00.000Z' },
          updated_at: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:15.000Z' },
        },
      },
      Audio: {
        type: 'object',
        description: 'A generated audio record. Created automatically when a prompt reaches COMPLETED status.',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'c7f4e5a6-9012-4cde-aef1-000000000003' },
          prompt_id: { type: 'string', format: 'uuid', example: 'b5e2d3f4-5678-4bcd-9ef0-000000000002' },
          user_id: { type: 'string', format: 'uuid', example: 'a3f1c2d4-1234-4abc-8def-000000000001' },
          title: { type: 'string', example: 'Generated Audio for Prompt b5e2d3f4' },
          url: { type: 'string', example: 'https://cdn.musicgpt.ai/audio/b5e2d3f4.mp3' },
          created_at: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:18.000Z' },
          updated_at: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:18.000Z' },
        },
      },
      AuthTokens: {
        type: 'object',
        description: 'JWT token pair returned on successful auth operations.',
        properties: {
          accessToken: {
            type: 'string',
            description: 'Short-lived JWT (15 min). Use as Bearer token for all protected endpoints.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
          refreshToken: {
            type: 'string',
            description: 'Long-lived JWT (30 days). Use with POST /auth/refresh to rotate tokens.',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
        required: ['accessToken', 'refreshToken'],
      },
      PaginatedUsers: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/User' } },
          meta: {
            type: 'object',
            properties: {
              next_cursor: {
                type: 'string',
                nullable: true,
                description: 'Pass as `cursor` on the next request. null means no more pages.',
                example: 'a3f1c2d4-1234-4abc-8def-000000000099',
              },
            },
          },
        },
      },
      PaginatedAudio: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Audio' } },
          meta: {
            type: 'object',
            properties: {
              next_cursor: {
                type: 'string',
                nullable: true,
                description: 'Pass as `cursor` on the next request. null means no more pages.',
                example: null,
              },
            },
          },
        },
      },
      SearchResult: {
        type: 'object',
        description: 'Unified search results. Each resource type is independently paginated.',
        properties: {
          users: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/User' },
                    {
                      type: 'object',
                      properties: {
                        score: {
                          type: 'integer',
                          description: '2 = exact match, 1 = partial match',
                          example: 2,
                        },
                      },
                    },
                  ],
                },
              },
              meta: {
                type: 'object',
                properties: { next_cursor: { type: 'string', nullable: true, example: null } },
              },
            },
          },
          audio: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/Audio' },
                    {
                      type: 'object',
                      properties: {
                        score: {
                          type: 'integer',
                          description: '2 = exact match, 1 = partial match',
                          example: 1,
                        },
                      },
                    },
                  ],
                },
              },
              meta: {
                type: 'object',
                properties: { next_cursor: { type: 'string', nullable: true, example: null } },
              },
            },
          },
        },
      },
      Error400: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Validation error' },
          message: { type: 'string', example: 'email is required' },
        },
      },
      Error401: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Unauthorized' },
          message: { type: 'string', example: 'Invalid or expired token' },
        },
      },
      Error404: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Not found' },
          message: { type: 'string', example: 'Audio not found' },
        },
      },
      Error409: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Conflict' },
          message: { type: 'string', example: 'Email already in use' },
        },
      },
      Error429: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Too Many Requests' },
          message: { type: 'string', example: 'Rate limit exceeded. Try again in 42 seconds.' },
        },
      },
    },
    parameters: {
      CursorParam: {
        in: 'query',
        name: 'cursor',
        schema: { type: 'string', format: 'uuid' },
        description: 'Pagination cursor — the `next_cursor` from a previous response. Omit for the first page.',
        example: 'a3f1c2d4-1234-4abc-8def-000000000001',
      },
      LimitParam: {
        in: 'query',
        name: 'limit',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        description: 'Number of results per page (1–100, default 10).',
      },
      IdParam: {
        in: 'path',
        name: 'id',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Resource UUID',
        example: 'a3f1c2d4-1234-4abc-8def-000000000001',
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid Bearer token.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } },
      },
      NotFound: {
        description: 'Resource not found.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error404' } } },
      },
      RateLimited: {
        description: 'Rate limit exceeded. Check the `Retry-After` header.',
        headers: {
          'Retry-After': { schema: { type: 'integer' }, description: 'Seconds to wait before retrying' },
        },
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error429' } } },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        description: `Creates a new user account and returns a token pair.

On success, store the \`refreshToken\` securely and keep \`accessToken\` in memory. New accounts start on the FREE tier.`,
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'display_name'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  password: { type: 'string', minLength: 6, example: 'mysecretpassword' },
                  display_name: { type: 'string', example: 'Jane Doe' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Registration successful. Use the `accessToken` as Bearer token.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthTokens' },
                example: {
                  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhM2YxYzJkNC0xMjM0...',
                  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhM2YxYzJkNC0xMjM0...',
                },
              },
            },
          },
          '400': { description: 'Missing or invalid fields.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error400' } } } },
          '409': { description: 'Email is already registered.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error409' } } } },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        description: 'Authenticate and receive a new access + refresh token pair. Previous refresh tokens are invalidated (rotation).',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'jane@example.com' },
                  password: { type: 'string', example: 'mysecretpassword' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } },
          },
          '400': { description: 'Missing fields.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error400' } } } },
          '401': { description: 'Invalid email or password.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } } },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token',
        description: `Exchange a valid refresh token for a new access + refresh token pair.

**Token rotation**: the old refresh token is immediately invalidated after use. Always store the new refresh token returned.`,
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: {
                    type: 'string',
                    description: 'The refresh token from your last login or refresh call.',
                    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'New token pair issued. Discard old tokens.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokens' } } },
          },
          '401': { description: 'Refresh token is invalid, expired, or already used.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error401' } } } },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Logout',
        description: `Invalidates tokens immediately:
- Removes refresh token from the database
- Adds access token to Redis blacklist (valid until it naturally expires)

All subsequent requests with the old access token will return **401**.`,
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logged out successfully.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { message: { type: 'string', example: 'Logged out' } } },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/subscription/subscribe': {
      post: {
        summary: 'Upgrade to PAID',
        description: `Upgrades the authenticated user to the **PAID** tier.

**Benefits after upgrade**:
- Rate limit: 20 → 100 requests per minute
- Prompts enqueued with priority 1 (processed before FREE users)`,
        tags: ['Subscription'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Upgraded to PAID.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Subscribed successfully' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/subscription/cancel': {
      post: {
        summary: 'Cancel PAID subscription',
        description: 'Downgrades the user back to FREE tier. Rate limits and queue priority revert immediately.',
        tags: ['Subscription'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Subscription cancelled.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Subscription cancelled' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/prompts': {
      post: {
        summary: 'Submit a prompt for audio generation',
        description: `Creates a prompt and queues it for asynchronous processing.

**Flow after submission**:
1. Prompt created with status \`PENDING\`
2. Cron job (every 10s) enqueues it in BullMQ
3. Worker processes it: 2–5s simulated delay, creates an Audio record
4. Status → \`COMPLETED\`, WebSocket event sent to your channel

**Queue priority**: PAID users are processed before FREE users.

Poll \`GET /prompts/:id\` or connect via WebSocket at \`ws://host/ws?token=<accessToken>\` for real-time updates.`,
        tags: ['Prompts'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: {
                    type: 'string',
                    minLength: 1,
                    description: 'Text description for audio generation.',
                    example: 'Upbeat jazz piano with a walking bass line, 120 BPM',
                  },
                },
              },
            },
          },
        },
        responses: {
          '202': {
            description: 'Prompt accepted and queued.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Prompt' },
                example: {
                  id: 'b5e2d3f4-5678-4bcd-9ef0-000000000002',
                  user_id: 'a3f1c2d4-1234-4abc-8def-000000000001',
                  text: 'Upbeat jazz piano with a walking bass line, 120 BPM',
                  status: 'PENDING',
                  created_at: '2026-03-21T10:00:00.000Z',
                  updated_at: '2026-03-21T10:00:00.000Z',
                },
              },
            },
          },
          '400': { description: 'Missing or empty `text`.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error400' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/prompts/{id}': {
      get: {
        summary: 'Get prompt status',
        description: `Poll this to check if your audio is ready.

Status values: \`PENDING\` → \`PROCESSING\` → \`COMPLETED\`

Once \`COMPLETED\`, find the generated audio via \`GET /audio\`.`,
        tags: ['Prompts'],
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '200': {
            description: 'Prompt with current status.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Prompt' },
                example: {
                  id: 'b5e2d3f4-5678-4bcd-9ef0-000000000002',
                  text: 'Upbeat jazz piano with a walking bass line, 120 BPM',
                  status: 'COMPLETED',
                  created_at: '2026-03-21T10:00:00.000Z',
                  updated_at: '2026-03-21T10:00:17.000Z',
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/audio': {
      get: {
        summary: 'List all audio (paginated, cached)',
        description: `Returns a cursor-paginated list of all audio records.

**Caching**: responses cached in Redis for 60 seconds. Invalidated on any audio update.

**Pagination**: pass \`next_cursor\` from the response \`meta\` as \`cursor\` on your next request.`,
        tags: ['Audio'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          '200': {
            description: 'Paginated audio list.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedAudio' },
                example: {
                  data: [
                    {
                      id: 'c7f4e5a6-9012-4cde-aef1-000000000003',
                      prompt_id: 'b5e2d3f4-5678-4bcd-9ef0-000000000002',
                      user_id: 'a3f1c2d4-1234-4abc-8def-000000000001',
                      title: 'Generated Audio for Prompt b5e2d3f4',
                      url: 'https://cdn.musicgpt.ai/audio/b5e2d3f4.mp3',
                      created_at: '2026-03-21T10:00:18.000Z',
                      updated_at: '2026-03-21T10:00:18.000Z',
                    },
                  ],
                  meta: { next_cursor: null },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/audio/{id}': {
      get: {
        summary: 'Get audio by ID (cached)',
        description: 'Returns a single audio record. Cached in Redis for 60 seconds.',
        tags: ['Audio'],
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '200': {
            description: 'Audio record.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Audio' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
      put: {
        summary: 'Update audio title',
        description: 'Updates the title of an audio record. Invalidates all Redis cache keys for audio endpoints.',
        tags: ['Audio'],
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'My Jazz Track' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated audio record.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Audio' } } },
          },
          '400': { description: 'Missing title.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error400' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/users': {
      get: {
        summary: 'List all users (paginated, cached)',
        description: 'Cursor-paginated list of all users. Cached in Redis for 60 seconds.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/CursorParam' },
          { $ref: '#/components/parameters/LimitParam' },
        ],
        responses: {
          '200': {
            description: 'Paginated user list.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedUsers' },
                example: {
                  data: [
                    {
                      id: 'a3f1c2d4-1234-4abc-8def-000000000001',
                      email: 'jane@example.com',
                      display_name: 'Jane Doe',
                      subscription_status: 'FREE',
                      created_at: '2026-03-21T10:00:00.000Z',
                      updated_at: '2026-03-21T10:00:00.000Z',
                    },
                  ],
                  meta: { next_cursor: null },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/users/{id}': {
      get: {
        summary: 'Get user by ID (cached)',
        description: 'Returns a single user. Cached in Redis for 60 seconds.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        responses: {
          '200': {
            description: 'User record.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
      put: {
        summary: 'Update user profile',
        description: 'Updates the `display_name`. Invalidates all Redis cache keys for user endpoints.',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/IdParam' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['display_name'],
                properties: {
                  display_name: { type: 'string', example: 'Jane Smith' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated user record.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '400': { description: 'Missing display_name.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error400' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/search': {
      get: {
        summary: 'Unified search across users and audio',
        description: `Searches **users** (email, display_name) and **audio** (title) in one request with weighted ranking.

**Ranking**:
- Score 2 — exact match
- Score 1 — partial match (case-insensitive)
- Sorted by score DESC, then ID ASC for stable pagination

**Pagination**: users and audio each have their own independent cursor (\`user_cursor\`, \`audio_cursor\`).

**Example**: \`GET /search?q=jazz&limit=5\``,
        tags: ['Search'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            in: 'query',
            name: 'q',
            required: true,
            schema: { type: 'string', minLength: 1 },
            description: 'Search query. Matches against user email, display_name, and audio title.',
            example: 'jazz',
          },
          {
            in: 'query',
            name: 'user_cursor',
            schema: { type: 'string', format: 'uuid' },
            description: 'Cursor for user results (from previous response `users.meta.next_cursor`).',
          },
          {
            in: 'query',
            name: 'audio_cursor',
            schema: { type: 'string', format: 'uuid' },
            description: 'Cursor for audio results (from previous response `audio.meta.next_cursor`).',
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
            description: 'Max results per resource type per page.',
          },
        ],
        responses: {
          '200': {
            description: 'Search results with relevance scores.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SearchResult' },
                example: {
                  users: { data: [], meta: { next_cursor: null } },
                  audio: {
                    data: [
                      {
                        id: 'c7f4e5a6-9012-4cde-aef1-000000000003',
                        title: 'Generated Jazz Track',
                        url: 'https://cdn.musicgpt.ai/audio/abc.mp3',
                        prompt_id: 'b5e2d3f4-0001',
                        user_id: 'a3f1c2d4-0001',
                        score: 1,
                        created_at: '2026-03-21T10:00:18.000Z',
                        updated_at: '2026-03-21T10:00:18.000Z',
                      },
                    ],
                    meta: { next_cursor: null },
                  },
                },
              },
            },
          },
          '400': { description: 'Missing `q` param.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error400' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Returns 200 if the server is running. Used by Docker and Railway health checks.',
        tags: ['System'],
        responses: {
          '200': {
            description: 'Server is healthy.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time', example: '2026-03-21T10:00:00.000Z' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
