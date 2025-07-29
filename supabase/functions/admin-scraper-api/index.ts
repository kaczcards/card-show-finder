import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Create a Supabase client with the service role key
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Create a Supabase client with the user's JWT
const getSupabaseClient = (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null
  
  const jwt = authHeader.replace('Bearer ', '')
  return createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  )
}

// Check if the user is an admin
async function isAdmin(req: Request): Promise<boolean> {
  try {
    const supabase = getSupabaseClient(req)
    if (!supabase) return false
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return false
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) return false
    
    return profile.role?.toLowerCase() === 'admin'
  } catch (e) {
    console.error('Error checking admin status:', e)
    return false
  }
}

// Parse URL path and query parameters
function parseRequest(req: Request) {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/admin-scraper-api/, '')
  const params = path.split('/').filter(Boolean)
  const query = Object.fromEntries(url.searchParams)
  
  return { path, params, query }
}

// Handle GET /pending - List pending shows with pagination and filtering
async function getPendingShows(req: Request): Promise<Response> {
  try {
    const { query } = parseRequest(req)
    const supabase = getSupabaseAdmin()
    
    const status = query.status || 'PENDING'
    const limit = parseInt(query.limit || '50')
    const offset = parseInt(query.offset || '0')
    
    const { data, error } = await supabase.rpc('get_pending_shows', {
      p_status: status,
      p_limit: limit,
      p_offset: offset
    })
    
    if (error) throw new Error(error.message)
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error getting pending shows:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Handle POST /approve/:id - Approve a pending show
async function approveShow(req: Request): Promise<Response> {
  try {
    const { params } = parseRequest(req)
    const id = params[1] // /approve/:id
    
    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing show ID' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    const body = await req.json().catch(() => ({}))
    const adminNotes = body.notes || body.adminNotes || null
    
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('approve_pending_show', {
      p_pending_id: id,
      p_admin_notes: adminNotes
    })
    
    if (error) throw new Error(error.message)
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error approving show:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Handle POST /reject/:id - Reject a pending show
async function rejectShow(req: Request): Promise<Response> {
  try {
    const { params } = parseRequest(req)
    const id = params[1] // /reject/:id
    
    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing show ID' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    const body = await req.json().catch(() => ({}))
    const reason = body.reason || 'Rejected by admin'
    
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('reject_pending_show', {
      p_pending_id: id,
      p_reason: reason
    })
    
    if (error) throw new Error(error.message)
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error rejecting show:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Handle PATCH /edit/:id - Edit a pending show
async function editShow(req: Request): Promise<Response> {
  try {
    const { params } = parseRequest(req)
    const id = params[1] // /edit/:id
    
    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing show ID' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    const body = await req.json().catch(() => ({}))
    const normalizedJson = body.normalized_json || body.normalizedJson
    const adminNotes = body.notes || body.adminNotes || null
    
    if (!normalizedJson) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing normalized_json data' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('edit_pending_show', {
      p_pending_id: id,
      p_normalized_json: normalizedJson,
      p_admin_notes: adminNotes
    })
    
    if (error) throw new Error(error.message)
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error editing show:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Handle GET /sources - List scraping sources
async function getScrapingSources(req: Request): Promise<Response> {
  try {
    const { query } = parseRequest(req)
    const supabase = getSupabaseAdmin()
    
    const limit = parseInt(query.limit || '100')
    const offset = parseInt(query.offset || '0')
    
    const { data, error } = await supabase.rpc('get_scraping_sources', {
      p_limit: limit,
      p_offset: offset
    })
    
    if (error) throw new Error(error.message)
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error getting scraping sources:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Handle PATCH /sources/:url - Update scraping source
async function updateScrapingSource(req: Request): Promise<Response> {
  try {
    const { params } = parseRequest(req)
    const url = params[1] // /sources/:url
    
    if (!url) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing source URL' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }
    
    const body = await req.json().catch(() => ({}))
    const priorityScore = body.priority_score || body.priorityScore
    const enabled = body.enabled !== undefined ? body.enabled : null
    const notes = body.notes || null
    
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('update_scraping_source', {
      p_url: decodeURIComponent(url),
      p_priority_score: priorityScore,
      p_enabled: enabled,
      p_notes: notes
    })
    
    if (error) throw new Error(error.message)
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (e) {
    console.error('Error updating scraping source:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: e.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

// Main request handler
serve(async (req: Request) => {
  // Handle preflight CORS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Check if user is admin
    const admin = await isAdmin(req)
    if (!admin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: Admin access required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      })
    }
    
    // Parse the request
    const { path, params } = parseRequest(req)
    
    // Route the request to the appropriate handler
    if (path.startsWith('/pending') && req.method === 'GET') {
      return await getPendingShows(req)
    } else if (path.startsWith('/approve/') && req.method === 'POST') {
      return await approveShow(req)
    } else if (path.startsWith('/reject/') && req.method === 'POST') {
      return await rejectShow(req)
    } else if (path.startsWith('/edit/') && req.method === 'PATCH') {
      return await editShow(req)
    } else if (path.startsWith('/sources') && params.length === 1 && req.method === 'GET') {
      return await getScrapingSources(req)
    } else if (path.startsWith('/sources/') && params.length === 2 && req.method === 'PATCH') {
      return await updateScrapingSource(req)
    }
    
    // If no route matches
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Not found' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404
    })
  } catch (e) {
    console.error('Unhandled error:', e)
    return new Response(JSON.stringify({ 
      success: false, 
      error: `Unhandled error: ${e.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
