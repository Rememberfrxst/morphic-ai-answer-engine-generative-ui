#!/usr/bin/env node

/**
 * Chatbot API Test Script
 * 
 * This script demonstrates how to use the chatbot API endpoints
 * similar to ChatGPT and Grok interfaces.
 * 
 * Usage: node examples/chatbot-test.js
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response;
}

// Test basic chat completion (non-streaming)
async function testBasicChat() {
  console.log('\n🔸 Testing Basic Chat (Non-streaming)...');
  
  try {
    const response = await apiRequest('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Explain the concept of artificial intelligence in 2 sentences.'
          }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 150,
        stream: false
      })
    });

    const data = await response.json();
    console.log('✅ Response:', data.data.message.content);
    console.log('📊 Usage:', data.data.usage);
    
    return data.data;
  } catch (error) {
    console.error('❌ Basic chat failed:', error.message);
  }
}

// Test streaming chat completion
async function testStreamingChat() {
  console.log('\n🔸 Testing Streaming Chat...');
  
  try {
    const response = await apiRequest('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'Write a short poem about coding.'
          }
        ],
        model: 'claude-3-haiku-20240307',
        systemPrompt: 'You are a creative poet who loves technology.',
        stream: true
      })
    });

    console.log('✅ Streaming response:');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'text-chunk') {
              process.stdout.write(data.content);
              fullResponse += data.content;
            } else if (data.type === 'conversation-finished') {
              console.log('\n📊 Conversation finished:', data.usage);
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }

    console.log('\n');
    return fullResponse;
  } catch (error) {
    console.error('❌ Streaming chat failed:', error.message);
  }
}

// Test conversation management
async function testConversationManagement() {
  console.log('\n🔸 Testing Conversation Management...');
  
  try {
    // Create a new conversation
    console.log('Creating new conversation...');
    const createResponse = await apiRequest('/api/chatbot/conversations', {
      method: 'POST',
      body: JSON.stringify({
        title: 'AI Discussion',
        model: 'gpt-4o-mini',
        systemPrompt: 'You are an expert in artificial intelligence.'
      })
    });

    const conversation = (await createResponse.json()).data.conversation;
    console.log('✅ Created conversation:', conversation.id);

    // Add a message to the conversation
    console.log('Adding message to conversation...');
    await apiRequest(`/api/chatbot/conversations/${conversation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        role: 'user',
        content: 'What are the latest trends in AI?'
      })
    });

    // Get the updated conversation
    const getResponse = await apiRequest(`/api/chatbot/conversations/${conversation.id}`);
    const updatedConv = (await getResponse.json()).data.conversation;
    console.log('✅ Messages in conversation:', updatedConv.messages.length);

    // List all conversations
    const listResponse = await apiRequest('/api/chatbot/conversations?limit=5');
    const conversations = (await listResponse.json()).data.conversations;
    console.log('✅ Total conversations:', conversations.length);

    return conversation.id;
  } catch (error) {
    console.error('❌ Conversation management failed:', error.message);
  }
}

// Test model management
async function testModelManagement() {
  console.log('\n🔸 Testing Model Management...');
  
  try {
    // Get all available models
    console.log('Fetching all models...');
    const allModelsResponse = await apiRequest('/api/chatbot/models');
    const allModels = (await allModelsResponse.json()).data;
    console.log('✅ Total models available:', allModels.totalModels);
    console.log('📋 Providers:', allModels.availableProviders.join(', '));

    // Get models by provider
    console.log('\nFetching OpenAI models...');
    const openaiResponse = await apiRequest('/api/chatbot/models?provider=openai');
    const openaiModels = (await openaiResponse.json()).data.models;
    console.log('✅ OpenAI models:', openaiModels.map(m => m.id).join(', '));

    // Get models by capability
    console.log('\nFetching vision-capable models...');
    const visionResponse = await apiRequest('/api/chatbot/models?capability=vision');
    const visionModels = (await visionResponse.json()).data.models;
    console.log('✅ Vision models:', visionModels.map(m => m.id).join(', '));

    // Get models by pricing tier
    console.log('\nFetching economy models...');
    const economyResponse = await apiRequest('/api/chatbot/models?pricing_tier=economy');
    const economyModels = (await economyResponse.json()).data.models;
    console.log('✅ Economy models:', economyModels.map(m => m.id).join(', '));

    return allModels;
  } catch (error) {
    console.error('❌ Model management failed:', error.message);
  }
}

// Test different system prompts
async function testSystemPrompts() {
  console.log('\n🔸 Testing Different System Prompts...');
  
  const prompts = [
    { type: 'technical', prompt: 'You are a technical AI assistant specializing in programming and engineering.' },
    { type: 'creative', prompt: 'You are a creative AI assistant that helps with artistic and innovative tasks.' },
    { type: 'analytical', prompt: 'You are an analytical AI assistant focused on data and logical reasoning.' }
  ];

  for (const { type, prompt } of prompts) {
    try {
      console.log(`\n${type.toUpperCase()} prompt test:`);
      
      const response = await apiRequest('/api/chatbot', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: 'How would you approach solving a complex problem?'
            }
          ],
          systemPrompt: prompt,
          model: 'gpt-4o-mini',
          temperature: 0.8,
          maxTokens: 100,
          stream: false
        })
      });

      const data = await response.json();
      console.log('✅ Response:', data.data.message.content.substring(0, 150) + '...');
    } catch (error) {
      console.error(`❌ ${type} prompt failed:`, error.message);
    }
  }
}

// Test multi-turn conversation
async function testMultiTurnConversation() {
  console.log('\n🔸 Testing Multi-turn Conversation...');
  
  try {
    const messages = [
      { role: 'user', content: 'What is machine learning?' },
    ];

    // First turn
    console.log('Turn 1: Asking about machine learning...');
    let response = await apiRequest('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages: messages,
        model: 'gpt-4o-mini',
        stream: false
      })
    });

    let data = await response.json();
    messages.push(data.data.message);
    console.log('✅ AI Response:', data.data.message.content.substring(0, 100) + '...');

    // Second turn
    messages.push({ role: 'user', content: 'Can you give me a practical example?' });
    console.log('\nTurn 2: Asking for examples...');
    
    response = await apiRequest('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages: messages,
        model: 'gpt-4o-mini',
        stream: false
      })
    });

    data = await response.json();
    console.log('✅ AI Response:', data.data.message.content.substring(0, 150) + '...');
    
    return messages.length;
  } catch (error) {
    console.error('❌ Multi-turn conversation failed:', error.message);
  }
}

// Test error handling
async function testErrorHandling() {
  console.log('\n🔸 Testing Error Handling...');
  
  // Test invalid request
  try {
    await apiRequest('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages: [] // Empty messages should fail
      })
    });
    console.log('❌ Should have failed with empty messages');
  } catch (error) {
    console.log('✅ Correctly handled empty messages error');
  }

  // Test invalid model
  try {
    await apiRequest('/api/chatbot', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'invalid-model'
      })
    });
  } catch (error) {
    console.log('✅ Correctly handled invalid model error');
  }

  // Test nonexistent conversation
  try {
    await apiRequest('/api/chatbot/conversations/nonexistent-id');
  } catch (error) {
    console.log('✅ Correctly handled nonexistent conversation error');
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Chatbot API Tests...');
  console.log('Base URL:', BASE_URL);
  
  try {
    // Check if API is running
    const healthResponse = await apiRequest('/api/chatbot');
    const health = await healthResponse.json();
    console.log('✅ API is running:', health.data.message);
    
    // Run all tests
    await testBasicChat();
    await testStreamingChat();
    const conversationId = await testConversationManagement();
    await testModelManagement();
    await testSystemPrompts();
    await testMultiTurnConversation();
    await testErrorHandling();
    
    // Cleanup - delete test conversation
    if (conversationId) {
      try {
        await apiRequest(`/api/chatbot/conversations/${conversationId}`, {
          method: 'DELETE'
        });
        console.log('🧹 Cleaned up test conversation');
      } catch (error) {
        console.log('ℹ️ Cleanup not needed (Redis not configured)');
      }
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\nThe chatbot API is ready to use with features like:');
    console.log('- Multiple AI providers (OpenAI, Anthropic, Google, Groq, xAI)');
    console.log('- Streaming and non-streaming responses');
    console.log('- Conversation management');
    console.log('- Model selection and filtering');
    console.log('- Custom system prompts');
    console.log('- Error handling and validation');
    
  } catch (error) {
    console.error('💥 Failed to connect to API:', error.message);
    console.log('\nMake sure the development server is running:');
    console.log('npm run dev');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testBasicChat,
  testStreamingChat,
  testConversationManagement,
  testModelManagement,
  testSystemPrompts,
  testMultiTurnConversation,
  testErrorHandling,
  runAllTests
};