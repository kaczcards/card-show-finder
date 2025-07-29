import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Simple function to test Google AI API key without authentication
serve(async (req) => {
  // Set CORS headers to allow all origins
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Simple AI key test starting...')
    
    // Get the API key from environment variables
    const apiKey = Deno.env.get('GOOGLE_AI_KEY')
    
    // Check if the key exists
    if (!apiKey) {
      console.error('GOOGLE_AI_KEY not set in environment variables')
      return new Response(JSON.stringify({
        success: false,
        error: 'GOOGLE_AI_KEY not set in environment variables',
        fix: 'Set GOOGLE_AI_KEY in Supabase Dashboard → Settings → Edge Functions → Environment Variables'
      }), { 
        headers: corsHeaders,
        status: 400 
      })
    }
    
    console.log(`API key found (starts with ${apiKey.substring(0, 5)}...)`)
    
    // Make a simple test request to Gemini API
    const model = 'gemini-1.5-flash'
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    
    console.log(`Testing with model: ${model}`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ text: 'Say "The API key is working!" if you can read this.' }] 
        }]
      })
    })
    
    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API request failed: ${response.status} ${response.statusText}`)
      console.error('Error details:', errorText)
      
      let errorDetails
      try {
        errorDetails = JSON.parse(errorText)
      } catch {
        errorDetails = { raw: errorText }
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: `API request failed: ${response.status} ${response.statusText}`,
        details: errorDetails,
        troubleshooting: [
          "Check if the API key is valid and not expired",
          "Verify the API key has access to the Gemini API",
          "Make sure billing is enabled for your Google Cloud project",
          "Check if you've exceeded your quota or rate limits"
        ]
      }), { 
        headers: corsHeaders,
        status: 400 
      })
    }
    
    // Parse the successful response
    const result = await response.json()
    
    // Extract the response text
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No text response'
    
    console.log(`API response: "${responseText}"`)
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Google AI API key is working!',
      apiResponse: responseText,
      keyPrefix: apiKey.substring(0, 5) + '...',
      model: model
    }), { 
      headers: corsHeaders,
      status: 200 
    })
    
  } catch (e) {
    console.error('Unexpected error:', e)
    
    return new Response(JSON.stringify({
      success: false,
      error: `Unexpected error: ${e.message}`,
      stack: e.stack
    }), { 
      headers: corsHeaders,
      status: 500 
    })
  }
})
