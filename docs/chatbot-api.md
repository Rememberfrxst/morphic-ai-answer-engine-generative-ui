# Chatbot API Documentation

This API provides ChatGPT and Grok-style chatbot functionality with streaming responses, conversation management, and multi-model support.

## Base URL
```
/api/chatbot
```

## Authentication
All endpoints require user authentication. Include your session token in requests.

## Endpoints

### 1. Chat Completion
Create a chat completion with streaming or non-streaming responses.

#### `POST /api/chatbot`

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "conversationId": "optional-conversation-id",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "maxTokens": 2000,
  "stream": true,
  "systemPrompt": "You are a helpful assistant."
}
```

**Parameters:**
- `messages` (required): Array of message objects with `role` and `content`
- `conversationId` (optional): ID to associate with a conversation
- `model` (optional): Model to use (defaults to user's saved preference)
- `temperature` (optional): Controls randomness (0-2, default: 0.7)
- `maxTokens` (optional): Maximum tokens to generate (1-4000, default: 2000)
- `stream` (optional): Enable streaming responses (default: true)
- `systemPrompt` (optional): Custom system prompt

**Response (Streaming):**
```
data: {"type":"text-chunk","content":"Hello","conversationId":"123"}
data: {"type":"text-chunk","content":" there","conversationId":"123"}
data: {"type":"conversation-finished","conversationId":"123","usage":{"totalTokens":150}}
```

**Response (Non-streaming):**
```json
{
  "success": true,
  "data": {
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing well, thank you for asking..."
    },
    "conversationId": "123",
    "model": "gpt-4o-mini",
    "usage": {
      "totalTokens": 150
    }
  }
}
```

#### `GET /api/chatbot`
Get API information and available endpoints.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Chatbot API is running",
    "availableModels": {
      "openai": "gpt-4o-mini",
      "anthropic": "claude-3-haiku-20240307",
      "google": "gemini-1.5-flash",
      "groq": "llama-3.1-8b-instant",
      "xai": "grok-beta"
    },
    "systemPrompts": ["default", "creative", "technical", "analytical", "casual"],
    "endpoints": {
      "chat": "/api/chatbot",
      "conversations": "/api/chatbot/conversations",
      "models": "/api/chatbot/models"
    }
  }
}
```

### 2. Conversation Management

#### `GET /api/chatbot/conversations`
List all conversations for the authenticated user.

**Query Parameters:**
- `limit` (optional): Number of conversations to return (max 100, default: 20)
- `offset` (optional): Number of conversations to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv_123",
        "title": "General Discussion",
        "messages": [],
        "model": "gpt-4o-mini",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:35:00Z",
        "userId": "user_456"
      }
    ],
    "total": 1,
    "hasMore": false
  }
}
```

#### `POST /api/chatbot/conversations`
Create a new conversation.

**Request Body:**
```json
{
  "title": "New Conversation",
  "model": "gpt-4o-mini",
  "systemPrompt": "You are a helpful assistant."
}
```

#### `GET /api/chatbot/conversations/{id}`
Get a specific conversation by ID.

#### `PUT /api/chatbot/conversations/{id}`
Update a conversation (title or messages).

**Request Body:**
```json
{
  "title": "Updated Title",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### `PATCH /api/chatbot/conversations/{id}`
Add a message to a conversation.

**Request Body:**
```json
{
  "role": "user",
  "content": "New message"
}
```

#### `DELETE /api/chatbot/conversations/{id}`
Delete a specific conversation.

#### `DELETE /api/chatbot/conversations?ids=conv1,conv2`
Delete multiple conversations.

### 3. Model Management

#### `GET /api/chatbot/models`
List available AI models with capabilities and pricing information.

**Query Parameters:**
- `provider` (optional): Filter by provider (openai, anthropic, google, groq, xai)
- `capability` (optional): Filter by capability (text, vision, tool-calling, real-time-info)
- `pricing_tier` (optional): Filter by pricing (economy, standard, premium)

**Response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-4o-mini",
        "name": "GPT-4o mini",
        "provider": "OpenAI",
        "providerId": "openai",
        "enabled": true,
        "description": "Affordable and intelligent small model",
        "contextWindow": 128000,
        "maxOutputTokens": 16384,
        "capabilities": ["text", "vision", "tool-calling"],
        "pricingTier": "standard",
        "isEnabled": true
      }
    ],
    "modelsByProvider": {
      "openai": [...]
    },
    "providerStats": [
      {
        "provider": "openai",
        "totalModels": 4,
        "enabledModels": 4,
        "capabilities": ["text", "vision", "tool-calling"],
        "pricingTiers": ["economy", "standard", "premium"]
      }
    ]
  }
}
```

#### `POST /api/chatbot/models`
Update model preferences.

**Request Body:**
```json
{
  "modelId": "gpt-4o-mini",
  "preferences": {
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

## System Prompts

The API includes predefined system prompts for different use cases:

- **default**: General helpful assistant
- **creative**: Creative writing and brainstorming
- **technical**: Programming and technical support
- **analytical**: Data analysis and research
- **casual**: Friendly conversational tone

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": [] // Additional validation errors if applicable
}
```

Common HTTP status codes:
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (authentication required)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

## Rate Limiting

- Chat completion: 100 requests per minute
- Conversation management: 200 requests per minute
- Model queries: 500 requests per minute

## Usage Examples

### Basic Chat
```javascript
const response = await fetch('/api/chatbot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Explain quantum computing' }
    ],
    model: 'gpt-4o-mini',
    stream: false
  })
});

const data = await response.json();
console.log(data.data.message.content);
```

### Streaming Chat
```javascript
const response = await fetch('/api/chatbot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Tell me a story' }],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'text-chunk') {
        console.log(data.content);
      }
    }
  }
}
```

### Create and Manage Conversations
```javascript
// Create conversation
const conv = await fetch('/api/chatbot/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Project Discussion',
    model: 'claude-3-haiku-20240307'
  })
});

const conversationId = (await conv.json()).data.conversation.id;

// Add message
await fetch(`/api/chatbot/conversations/${conversationId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    role: 'user',
    content: 'Let\'s discuss the new features'
  })
});

// List conversations
const conversations = await fetch('/api/chatbot/conversations');
```

### Model Selection
```javascript
// Get available models
const models = await fetch('/api/chatbot/models?capability=vision');
const visionModels = (await models.json()).data.models;

// Use specific model
const response = await fetch('/api/chatbot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Describe this image' }],
    model: 'gpt-4o',
    systemPrompt: 'You are an expert at image analysis'
  })
});
```

This API provides enterprise-grade chatbot functionality with features comparable to ChatGPT and Grok, including:

- ✅ Multiple AI providers (OpenAI, Anthropic, Google, Groq, xAI)
- ✅ Streaming and non-streaming responses
- ✅ Conversation persistence and management
- ✅ Model selection and capabilities
- ✅ Custom system prompts
- ✅ Rate limiting and error handling
- ✅ User authentication and authorization
- ✅ Redis-based conversation storage
- ✅ Token usage tracking