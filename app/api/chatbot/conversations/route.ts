import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { redis } from '@/lib/redis/config'
import { z } from 'zod'
import { nanoid } from 'nanoid'

export const runtime = 'edge'

// Validation schemas
const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string()
  })),
  model: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  userId: z.string()
})

const CreateConversationSchema = z.object({
  title: z.string().min(1).max(100),
  model: z.string().optional(),
  systemPrompt: z.string().optional()
})

const UpdateConversationSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    timestamp: z.string().optional()
  })).optional()
})

// Helper functions
async function getConversationKey(userId: string, conversationId: string) {
  return `conversation:${userId}:${conversationId}`
}

async function getUserConversationsKey(userId: string) {
  return `conversations:${userId}`
}

// GET /api/chatbot/conversations - List all conversations for the user
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0)

    if (!redis) {
      return Response.json({
        success: true,
        data: {
          conversations: [],
          total: 0,
          hasMore: false
        }
      })
    }

    // Get conversation IDs for the user
    const conversationIds = await redis.zrevrange(
      await getUserConversationsKey(userId),
      offset,
      offset + limit - 1
    )

    if (!conversationIds.length) {
      return Response.json({
        success: true,
        data: {
          conversations: [],
          total: 0,
          hasMore: false
        }
      })
    }

    // Get conversation details
    const conversations = await Promise.all(
      conversationIds.map(async (id) => {
        const key = await getConversationKey(userId, id)
        const data = await redis.get(key)
        return data ? JSON.parse(data) : null
      })
    )

    const validConversations = conversations.filter(Boolean)
    const total = await redis.zcard(await getUserConversationsKey(userId))

    return Response.json({
      success: true,
      data: {
        conversations: validConversations,
        total,
        hasMore: offset + limit < total
      }
    })

  } catch (error) {
    console.error('Failed to get conversations:', error)
    return Response.json(
      { success: false, error: 'Failed to retrieve conversations' },
      { status: 500 }
    )
  }
}

// POST /api/chatbot/conversations - Create a new conversation
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { title, model = 'gpt-4o-mini', systemPrompt } = CreateConversationSchema.parse(body)

    const conversationId = nanoid()
    const now = new Date().toISOString()

    const conversation = {
      id: conversationId,
      title,
      messages: systemPrompt ? [{
        role: 'system' as const,
        content: systemPrompt,
        timestamp: now
      }] : [],
      model,
      createdAt: now,
      updatedAt: now,
      userId
    }

    if (redis) {
      // Store conversation
      const key = await getConversationKey(userId, conversationId)
      await redis.set(key, JSON.stringify(conversation), { ex: 30 * 24 * 60 * 60 }) // 30 days

      // Add to user's conversation list (sorted by creation time)
      const userKey = await getUserConversationsKey(userId)
      await redis.zadd(userKey, Date.now(), conversationId)
      await redis.expire(userKey, 30 * 24 * 60 * 60) // 30 days
    }

    return Response.json({
      success: true,
      data: { conversation }
    })

  } catch (error) {
    console.error('Failed to create conversation:', error)
    
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
      { success: false, error: 'Failed to create conversation' },
      { status: 500 }
    )
  }
}

// DELETE /api/chatbot/conversations - Delete multiple conversations
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const conversationIds = url.searchParams.get('ids')?.split(',') || []

    if (!conversationIds.length) {
      return Response.json(
        { success: false, error: 'No conversation IDs provided' },
        { status: 400 }
      )
    }

    if (!redis) {
      return Response.json({
        success: true,
        data: { deletedCount: 0 }
      })
    }

    let deletedCount = 0

    for (const conversationId of conversationIds) {
      const key = await getConversationKey(userId, conversationId)
      const deleted = await redis.del(key)
      
      if (deleted) {
        // Remove from user's conversation list
        const userKey = await getUserConversationsKey(userId)
        await redis.zrem(userKey, conversationId)
        deletedCount++
      }
    }

    return Response.json({
      success: true,
      data: { deletedCount }
    })

  } catch (error) {
    console.error('Failed to delete conversations:', error)
    return Response.json(
      { success: false, error: 'Failed to delete conversations' },
      { status: 500 }
    )
  }
}