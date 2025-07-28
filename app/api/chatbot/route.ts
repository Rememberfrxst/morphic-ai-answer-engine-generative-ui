import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { Model } from '@/lib/types/models'
import { isProviderEnabled } from '@/lib/utils/registry'
import { 
  convertToCoreMessages,
  createDataStreamResponse,
  DataStreamWriter,
  streamText,
  CoreMessage 
} from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'
import { xai } from '@ai-sdk/xai'
import { cookies } from 'next/headers'
import { z } from 'zod'

export const maxDuration = 60
export const runtime = 'edge'

// Input validation schema
const ChatbotRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })),
  conversationId: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
  stream: z.boolean().optional().default(true),
  systemPrompt: z.string().optional()
})

// Default models for different providers
const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-haiku-20240307',
  google: 'gemini-1.5-flash',
  groq: 'llama-3.1-8b-instant',
  xai: 'grok-beta'
}

// Get AI provider based on model
function getProvider(model: string) {
  if (model.startsWith('gpt-') || model.includes('openai')) {
    return { provider: openai, modelId: model }
  }
  if (model.startsWith('claude-') || model.includes('anthropic')) {
    return { provider: anthropic, modelId: model }
  }
  if (model.startsWith('gemini-') || model.includes('google')) {
    return { provider: google, modelId: model }
  }
  if (model.includes('llama') || model.includes('groq')) {
    return { provider: groq, modelId: model }
  }
  if (model.includes('grok') || model.includes('xai')) {
    return { provider: xai, modelId: model }
  }
  
  // Default to OpenAI
  return { provider: openai, modelId: DEFAULT_MODELS.openai }
}

// System prompts for different chatbot personalities
const SYSTEM_PROMPTS = {
  default: "You are a helpful, harmless, and honest AI assistant. Provide accurate, detailed, and well-structured responses to user queries.",
  creative: "You are a creative and imaginative AI assistant. Help users with creative tasks, brainstorming, and innovative solutions.",
  technical: "You are a technical AI assistant specializing in programming, engineering, and technical problem-solving. Provide precise, detailed technical guidance.",
  analytical: "You are an analytical AI assistant focused on data analysis, research, and logical reasoning. Provide thorough, evidence-based responses.",
  casual: "You are a friendly and casual AI assistant. Engage in natural, conversational dialogue while being helpful and informative."
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validatedData = ChatbotRequestSchema.parse(body)
    
    const { 
      messages, 
      conversationId,
      model: requestedModel,
      temperature = 0.7,
      maxTokens = 2000,
      stream,
      systemPrompt
    } = validatedData

    // Get user authentication
    const userId = await getCurrentUserId()
    
    // Get model from cookies or use requested model
    const cookieStore = await cookies()
    const savedModelJson = cookieStore.get('selectedModel')?.value
    let selectedModel = requestedModel || DEFAULT_MODELS.openai

    if (savedModelJson && !requestedModel) {
      try {
        const parsedModel = JSON.parse(savedModelJson) as Model
        selectedModel = parsedModel.id
      } catch (e) {
        console.error('Failed to parse saved model:', e)
      }
    }

    // Get AI provider and model
    const { provider, modelId } = getProvider(selectedModel)

    // Prepare system message
    const systemMessage: CoreMessage = {
      role: 'system',
      content: systemPrompt || SYSTEM_PROMPTS.default
    }

    // Convert messages and add system prompt
    const coreMessages = convertToCoreMessages([
      systemMessage,
      ...messages
    ])

    if (stream) {
      // Streaming response
      return createDataStreamResponse({
        execute: async (dataStream: DataStreamWriter) => {
          try {
            const result = streamText({
              model: provider(modelId),
              messages: coreMessages,
              temperature,
              maxTokens,
              onFinish: async (result) => {
                // Log conversation metrics
                console.log(`Conversation ${conversationId} completed:`, {
                  userId,
                  model: selectedModel,
                  tokensUsed: result.usage?.totalTokens || 0,
                  responseTime: result.finishReason
                })

                // Send completion data
                dataStream.writeData({
                  type: 'conversation-finished',
                  conversationId,
                  usage: result.usage,
                  finishReason: result.finishReason
                })
              },
              onChunk: async (chunk) => {
                // Send chunk data for real-time updates
                dataStream.writeData({
                  type: 'text-chunk',
                  content: chunk.text,
                  conversationId
                })
              }
            })

            // Pipe the stream
            result.pipeDataStreamToResponse(dataStream)
          } catch (error) {
            console.error('Streaming error:', error)
            dataStream.writeData({
              type: 'error',
              error: 'Failed to generate response',
              conversationId
            })
          }
        }
      })
    } else {
      // Non-streaming response
      const result = await streamText({
        model: provider(modelId),
        messages: coreMessages,
        temperature,
        maxTokens
      })

      const response = await result.text

      return Response.json({
        success: true,
        data: {
          message: {
            role: 'assistant',
            content: response
          },
          conversationId,
          model: selectedModel,
          usage: result.usage
        }
      })
    }

  } catch (error) {
    console.error('Chatbot API error:', error)
    
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
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return Response.json({
    success: true,
    data: {
      message: 'Chatbot API is running',
      availableModels: DEFAULT_MODELS,
      systemPrompts: Object.keys(SYSTEM_PROMPTS),
      endpoints: {
        chat: '/api/chatbot',
        conversations: '/api/chatbot/conversations',
        models: '/api/chatbot/models'
      }
    }
  })
}