import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { redis } from '@/lib/redis/config'
import { z } from 'zod'

export const runtime = 'edge'

// Validation schemas
const UpdateConversationSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional()
  })).optional()
})

const AddMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
})

// Helper functions
async function getConversationKey(userId: string, conversationId: string) {
  return `conversation:${userId}:${conversationId}`
}

async function getUserConversationsKey(userId: string) {
  return `conversations:${userId}`
}

async function getConversation(userId: string, conversationId: string) {
  if (!redis) return null
  
  const key = await getConversationKey(userId, conversationId)
  const data = await redis.get(key)
  return data ? JSON.parse(data) : null
}

async function saveConversation(userId: string, conversation: any) {
  if (!redis) return false
  
  const key = await getConversationKey(userId, conversation.id)
  conversation.updatedAt = new Date().toISOString()
  
  await redis.set(key, JSON.stringify(conversation), { ex: 30 * 24 * 60 * 60 }) // 30 days
  
  // Update timestamp in user's conversation list
  const userKey = await getUserConversationsKey(userId)
  await redis.zadd(userKey, Date.now(), conversation.id)
  
  return true
}

// GET /api/chatbot/conversations/[id] - Get a specific conversation
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversationId = params.id
    const conversation = await getConversation(userId, conversationId)

    if (!conversation) {
      return Response.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    return Response.json({
      success: true,
      data: { conversation }
    })

  } catch (error) {
    console.error('Failed to get conversation:', error)
    return Response.json(
      { success: false, error: 'Failed to retrieve conversation' },
      { status: 500 }
    )
  }
}

// PUT /api/chatbot/conversations/[id] - Update a conversation
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { title, messages } = UpdateConversationSchema.parse(body)
    
    const conversationId = params.id
    const conversation = await getConversation(userId, conversationId)

    if (!conversation) {
      return Response.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Update conversation
    if (title !== undefined) {
      conversation.title = title
    }
    
    if (messages !== undefined) {
      conversation.messages = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp || new Date().toISOString()
      }))
    }

    const saved = await saveConversation(userId, conversation)
    
    if (!saved) {
      return Response.json(
        { success: false, error: 'Failed to save conversation' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: { conversation }
    })

  } catch (error) {
    console.error('Failed to update conversation:', error)
    
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return Response.json(
      { success: false, error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}

// DELETE /api/chatbot/conversations/[id] - Delete a conversation
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const conversationId = params.id

    if (!redis) {
      return Response.json({
        success: true,
        data: { deleted: false }
      })
    }

    // Check if conversation exists
    const conversation = await getConversation(userId, conversationId)
    if (!conversation) {
      return Response.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Delete conversation
    const key = await getConversationKey(userId, conversationId)
    const deleted = await redis.del(key)

    if (deleted) {
      // Remove from user's conversation list
      const userKey = await getUserConversationsKey(userId)
      await redis.zrem(userKey, conversationId)
    }

    return Response.json({
      success: true,
      data: { deleted: deleted > 0 }
    })

  } catch (error) {
    console.error('Failed to delete conversation:', error)
    return Response.json(
      { success: false, error: 'Failed to delete conversation' },
      { status: 500 }
    )
  }
}

// PATCH /api/chatbot/conversations/[id] - Add a message to conversation
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { role, content } = AddMessageSchema.parse(body)
    
    const conversationId = params.id
    const conversation = await getConversation(userId, conversationId)

    if (!conversation) {
      return Response.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Add new message
    const newMessage = {
      role,
      content,
      timestamp: new Date().toISOString()
    }

    conversation.messages.push(newMessage)

    const saved = await saveConversation(userId, conversation)
    
    if (!saved) {
      return Response.json(
        { success: false, error: 'Failed to save message' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: { 
        conversation,
        addedMessage: newMessage
      }
    })

  } catch (error) {
    console.error('Failed to add message:', error)
    
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          success: false,
          error: 'Invalid request format',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return Response.json(
      { success: false, error: 'Failed to add message' },
      { status: 500 }
    )
  }
}