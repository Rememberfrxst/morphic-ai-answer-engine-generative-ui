import { getModels } from '@/lib/config/models'
import { isProviderEnabled } from '@/lib/utils/registry'

export const runtime = 'edge'

// Extended model information with capabilities and pricing tiers
const MODEL_DETAILS = {
  // OpenAI Models
  'gpt-4o': {
    description: 'Most advanced multimodal model with high intelligence',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'premium',
    provider: 'OpenAI'
  },
  'gpt-4o-mini': {
    description: 'Affordable and intelligent small model for fast, lightweight tasks',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'standard',
    provider: 'OpenAI'
  },
  'gpt-4-turbo': {
    description: 'Previous generation flagship model with broad capabilities',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'premium',
    provider: 'OpenAI'
  },
  'gpt-3.5-turbo': {
    description: 'Fast, inexpensive model for simple tasks',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    capabilities: ['text', 'tool-calling'],
    pricingTier: 'economy',
    provider: 'OpenAI'
  },
  
  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    description: 'Most advanced Claude model with superior reasoning',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'premium',
    provider: 'Anthropic'
  },
  'claude-3-5-haiku-20241022': {
    description: 'Fast and affordable Claude model',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'standard',
    provider: 'Anthropic'
  },
  'claude-3-haiku-20240307': {
    description: 'Fastest model for simple text tasks',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    capabilities: ['text', 'tool-calling'],
    pricingTier: 'economy',
    provider: 'Anthropic'
  },
  
  // Google Models
  'gemini-1.5-pro': {
    description: 'Advanced reasoning and long context model',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'premium',
    provider: 'Google'
  },
  'gemini-1.5-flash': {
    description: 'Fast and efficient model for high-frequency tasks',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    capabilities: ['text', 'vision', 'tool-calling'],
    pricingTier: 'standard',
    provider: 'Google'
  },
  
  // Groq Models
  'llama-3.1-8b-instant': {
    description: 'Fast Llama model optimized for speed',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['text', 'tool-calling'],
    pricingTier: 'economy',
    provider: 'Groq'
  },
  'llama-3.1-70b-versatile': {
    description: 'Large Llama model with strong capabilities',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['text', 'tool-calling'],
    pricingTier: 'standard',
    provider: 'Groq'
  },
  
  // xAI Models
  'grok-beta': {
    description: 'Grok model with real-time information access',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    capabilities: ['text', 'real-time-info'],
    pricingTier: 'premium',
    provider: 'xAI'
  }
}

// GET /api/chatbot/models - List available models
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const provider = url.searchParams.get('provider')
    const capability = url.searchParams.get('capability')
    const pricingTier = url.searchParams.get('pricing_tier')

    // Get models from config
    const configModels = await getModels()
    
    // Enrich models with detailed information
    const enrichedModels = configModels.map(model => {
      const details = MODEL_DETAILS[model.id as keyof typeof MODEL_DETAILS]
      
      return {
        ...model,
        description: details?.description || 'AI language model',
        contextWindow: details?.contextWindow || 4096,
        maxOutputTokens: details?.maxOutputTokens || 2048,
        capabilities: details?.capabilities || ['text'],
        pricingTier: details?.pricingTier || 'standard',
        isEnabled: model.enabled && isProviderEnabled(model.providerId)
      }
    })

    // Filter models based on query parameters
    let filteredModels = enrichedModels

    if (provider) {
      filteredModels = filteredModels.filter(model => 
        model.providerId.toLowerCase() === provider.toLowerCase()
      )
    }

    if (capability) {
      filteredModels = filteredModels.filter(model =>
        model.capabilities.includes(capability)
      )
    }

    if (pricingTier) {
      filteredModels = filteredModels.filter(model =>
        model.pricingTier === pricingTier
      )
    }

    // Group models by provider
    const modelsByProvider = filteredModels.reduce((acc, model) => {
      if (!acc[model.providerId]) {
        acc[model.providerId] = []
      }
      acc[model.providerId].push(model)
      return acc
    }, {} as Record<string, any[]>)

    // Get provider statistics
    const providerStats = Object.entries(modelsByProvider).map(([providerId, models]) => ({
      provider: providerId,
      totalModels: models.length,
      enabledModels: models.filter(m => m.isEnabled).length,
      capabilities: [...new Set(models.flatMap(m => m.capabilities))],
      pricingTiers: [...new Set(models.map(m => m.pricingTier))]
    }))

    return Response.json({
      success: true,
      data: {
        models: filteredModels,
        modelsByProvider,
        providerStats,
        totalModels: filteredModels.length,
        availableProviders: Object.keys(modelsByProvider),
        availableCapabilities: [...new Set(filteredModels.flatMap(m => m.capabilities))],
        availablePricingTiers: [...new Set(filteredModels.map(m => m.pricingTier))]
      }
    })

  } catch (error) {
    console.error('Failed to get models:', error)
    return Response.json(
      { success: false, error: 'Failed to retrieve models' },
      { status: 500 }
    )
  }
}

// POST /api/chatbot/models - Add or update model preferences
export async function POST(req: Request) {
  try {
    const { modelId, preferences } = await req.json()

    if (!modelId) {
      return Response.json(
        { success: false, error: 'Model ID is required' },
        { status: 400 }
      )
    }

    // In a real implementation, you would save user preferences to database
    // For now, we'll just validate the model exists
    const configModels = await getModels()
    const model = configModels.find(m => m.id === modelId)

    if (!model) {
      return Response.json(
        { success: false, error: 'Model not found' },
        { status: 404 }
      )
    }

    if (!model.enabled || !isProviderEnabled(model.providerId)) {
      return Response.json(
        { success: false, error: 'Model is not available' },
        { status: 400 }
      )
    }

    return Response.json({
      success: true,
      data: {
        message: 'Model preferences updated',
        model: {
          ...model,
          preferences: preferences || {}
        }
      }
    })

  } catch (error) {
    console.error('Failed to update model preferences:', error)
    return Response.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    )
  }
}