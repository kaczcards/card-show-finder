import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

const AI_MODEL = 'gemini-1.5-flash'

serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    console.log('Testing Google AI API key...')
    
    // Get the API key from environment variables
    const geminiApiKey = Deno.env.get('GOOGLE_AI_KEY')
    
    // Check if the key exists
    if (!geminiApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'GOOGLE_AI_KEY environment variable is not set',
        details: 'Please set the GOOGLE_AI_KEY environment variable in Supabase Dashboard → Settings → Edge Functions → Environment Variables'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    console.log(`API key found (starts with ${geminiApiKey.substring(0, 5)}...)`)
    
    // Prepare a simple test prompt
    const testPrompt = 'Respond with "API key is working!" if you receive this message.'
    
    // Construct the API URL
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${geminiApiKey}`
    
    console.log(`Making test request to Gemini API (${AI_MODEL})...`)
    
    // Make the API request
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: testPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40
        }
      })
    })
    
    // Check HTTP status
    if (!response.ok) {
      const errorText = await response.text()
      let errorDetails
      
      try {
        errorDetails = JSON.parse(errorText)
      } catch (e) {
        errorDetails = { rawError: errorText }
      }
      
      console.error(`API request failed: ${response.status} ${response.statusText}`)
      console.error('Error details:', errorDetails)
      
      return new Response(JSON.stringify({
        success: false,
        error: `API request failed with status ${response.status} ${response.statusText}`,
        details: errorDetails,
        troubleshooting: [
          "Check if the API key is valid and not expired",
          "Verify the API key has access to the Gemini API",
          "Make sure the model 'gemini-1.5-flash' is available to your API key",
          "Check if you've exceeded your quota or rate limits"
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status
      })
    }
    
    // Parse the response
    const result = await response.json()
    
    // Verify the response structure
    if (!result.candidates || !result.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('Unexpected API response structure:', result)
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Unexpected API response structure',
        details: result,
        troubleshooting: [
          "The API returned a 200 OK but the response format was unexpected",
          "This could indicate an API version change or other issue"
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }
    
    // Extract the response text
    const responseText = result.candidates[0].content.parts[0].text.trim()
    
    console.log(`API response received: "${responseText}"`)
    
    // Return success with details
    return new Response(JSON.stringify({
      success: true,
      message: 'Google AI API key is working correctly!',
      model: AI_MODEL,
      apiResponse: responseText,
      responseDetails: {
        candidates: result.candidates.length,
        usageMetadata: result.usageMetadata || null,
        promptTokenCount: result.usageMetadata?.promptTokenCount || 'Not provided',
        candidatesTokenCount: result.usageMetadata?.candidatesTokenCount || 'Not provided'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error testing API key:', e)
    
    return new Response(JSON.stringify({
      success: false,
      error: `Unexpected error: ${e.message}`,
      stack: e.stack,
      troubleshooting: [
        "This appears to be a runtime error, not an API key issue",
        "Check the Edge Function logs for more details"
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
