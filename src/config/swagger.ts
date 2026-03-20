export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'MusicGPT API',
    version: '1.0.0',
    description: 'Backend API for the MusicGPT AI Music Creation Platform. Includes authentication, subscription management, audio generation simulation, unified search, WebSockets, and more.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string' },
          display_name: { type: 'string' },
          subscription_status: { type: 'string', enum: ['FREE', 'PAID'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        }
      },
      Audio: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          prompt_id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          url: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        }
      },
      Prompt: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          text: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'COMPLETED'] },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        }
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        }
      },
      PaginatedMeta: {
        type: 'object',
        properties: {
          next_cursor: { type: 'string', nullable: true },
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        }
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'display_name'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                  display_name: { type: 'string' },
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Registration successful', content: { 'application/json': { schema: { '$ref': '#/components/schemas/AuthTokens' } } } },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Login with email and password',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Login successful', content: { 'application/json': { schema: { '$ref': '#/components/schemas/AuthTokens' } } } },
          '401': { description: 'Invalid credentials', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
        }
      }
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token using refresh token',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Tokens refreshed', content: { 'application/json': { schema: { '$ref': '#/components/schemas/AuthTokens' } } } },
          '401': { description: 'Invalid refresh token' },
        }
      }
    },
    '/auth/logout': {
      post: {
        summary: 'Logout (invalidate tokens)',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Logged out' },
          '401': { description: 'Unauthorized' },
        }
      }
    },
    '/subscription/subscribe': {
      post: {
        summary: 'Upgrade to PAID subscription',
        tags: ['Subscription'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Subscribed successfully' },
          '401': { description: 'Unauthorized' },
        }
      }
    },
    '/subscription/cancel': {
      post: {
        summary: 'Cancel PAID subscription',
        tags: ['Subscription'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Subscription cancelled' },
          '401': { description: 'Unauthorized' },
        }
      }
    },
    '/users': {
      get: {
        summary: 'List all users (paginated, cached)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'cursor', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          '200': { description: 'Paginated user list' },
        }
      }
    },
    '/users/{id}': {
      get: {
        summary: 'Get user by ID (cached)',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'User found' },
          '404': { description: 'Not found' },
        }
      },
      put: {
        summary: 'Update user',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { display_name: { type: 'string' } } } } }
        },
        responses: {
          '200': { description: 'Updated' },
        }
      }
    },
    '/audio': {
      get: {
        summary: 'List all audio (paginated, cached)',
        tags: ['Audio'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'cursor', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
        ],
        responses: { '200': { description: 'Paginated audio list' } }
      }
    },
    '/audio/{id}': {
      get: {
        summary: 'Get audio by ID (cached)',
        tags: ['Audio'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Audio found' }, '404': { description: 'Not found' } }
      },
      put: {
        summary: 'Update audio title',
        tags: ['Audio'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' } } } } } },
        responses: { '200': { description: 'Updated' } }
      }
    },
    '/prompts': {
      post: {
        summary: 'Submit a prompt for audio generation',
        tags: ['Prompts'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } }
        },
        responses: {
          '202': { description: 'Accepted for processing' },
          '400': { description: 'Validation error' },
        }
      }
    },
    '/prompts/{id}': {
      get: {
        summary: 'Get prompt status',
        tags: ['Prompts'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Prompt details' }, '404': { description: 'Not found' } }
      }
    },
    '/search': {
      get: {
        summary: 'Unified search across users and audio (weighted ranking)',
        tags: ['Search'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'q', required: true, schema: { type: 'string' }, description: 'Search query' },
          { in: 'query', name: 'user_cursor', schema: { type: 'string' } },
          { in: 'query', name: 'audio_cursor', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 10 } },
        ],
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    users: { type: 'object', properties: { data: { type: 'array' }, meta: { '$ref': '#/components/schemas/PaginatedMeta' } } },
                    audio: { type: 'object', properties: { data: { type: 'array' }, meta: { '$ref': '#/components/schemas/PaginatedMeta' } } },
                  }
                }
              }
            }
          },
          '400': { description: 'Missing query param' },
        }
      }
    },
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['System'],
        responses: { '200': { description: 'OK' } }
      }
    }
  }
};
