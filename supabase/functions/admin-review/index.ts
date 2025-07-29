import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Types
interface PendingShow {
  id: string
  source_url: string
  raw_payload: any
  normalized_json?: any
  geocoded_json?: any
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  admin_notes?: string
  created_at: string
  reviewed_at?: string
}

interface FeedbackStats {
  tag: string
  count: number
  percentage: number
}

interface QualityScore {
  score: number // 0-100
  issues: string[]
  recommendations: string[]
}

// Constants
const FEEDBACK_TAGS = [
  'DATE_FORMAT',
  'VENUE_MISSING',
  'ADDRESS_POOR',
  'DUPLICATE',
  'MULTI_EVENT_COLLAPSE',
  'EXTRA_HTML',
  'SPAM',
  'STATE_FULL',
  'CITY_MISSING'
]

// Create a Supabase client with the service role key for admin access
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Helper function to check if user is an admin
async function isAdmin(supabase: any, authHeader: string): Promise<boolean> {
  try {
    // Extract JWT token from Authorization header
    const token = authHeader?.split(' ')[1]
    if (!token) return false

    // Get user ID from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return false

    // Call the is_admin() function to check if user has admin role
    const { data: isAdminResult, error: adminError } = await supabase.rpc('is_admin')
    if (adminError) return false

    return isAdminResult === true
  } catch (e) {
    console.error('Error checking admin status:', e.message)
    return false
  }
}

// Calculate quality score for a pending show
function calculateQualityScore(show: PendingShow): QualityScore {
  const payload = show.raw_payload
  const issues: string[] = []
  const recommendations: string[] = []
  
  // Check for required fields
  if (!payload.name) {
    issues.push('Missing name')
    recommendations.push('Reject with TITLE_MISSING feedback')
  }
  
  if (!payload.startDate) {
    issues.push('Missing start date')
    recommendations.push('Reject with DATE_FORMAT feedback')
  } else if (payload.startDate.includes('AL') || 
             payload.startDate.match(/\d{1,2}[-–]\d{1,2}/) ||
             !payload.startDate.match(/\d{4}/)) {
    issues.push('Date format issues')
    recommendations.push('Consider DATE_FORMAT feedback')
  }
  
  if (!payload.city) {
    issues.push('Missing city')
    recommendations.push('Reject with CITY_MISSING feedback')
  }
  
  if (!payload.venueName && !payload.address) {
    issues.push('Missing venue and address')
    recommendations.push('Reject with VENUE_MISSING feedback')
  }
  
  if (payload.state && payload.state.length > 2) {
    issues.push('State not in 2-letter format')
    recommendations.push('Approve with STATE_FULL feedback')
  }
  
  // Check for HTML artifacts
  const descriptionHasHTML = payload.description && 
    (payload.description.includes('<') || 
     payload.description.includes('&nbsp;') ||
     payload.description.includes('&amp;'))
  
  if (descriptionHasHTML) {
    issues.push('HTML artifacts in description')
    recommendations.push('Edit or approve with EXTRA_HTML feedback')
  }
  
  // Calculate score (100 - deductions)
  let score = 100
  
  // Critical issues
  if (!payload.name) score -= 30
  if (!payload.startDate) score -= 30
  if (!payload.city) score -= 20
  if (!payload.venueName && !payload.address) score -= 20
  
  // Minor issues
  if (payload.state && payload.state.length > 2) score -= 5
  if (descriptionHasHTML) score -= 5
  
  return {
    score,
    issues,
    recommendations
  }
}

// Check for potential duplicates
async function findPotentialDuplicates(supabase: any, show: PendingShow): Promise<PendingShow[]> {
  const payload = show.raw_payload
  
  // Skip if missing essential data
  if (!payload.name || !payload.startDate) {
    return []
  }
  
  // Check for duplicates in pending shows
  const { data: pendingDuplicates, error: pendingError } = await supabase
    .from('scraped_shows_pending')
    .select('*')
    .neq('id', show.id)
    .eq('status', 'PENDING')
    .or(`raw_payload->name.ilike.${payload.name},raw_payload->startDate.eq.${payload.startDate}`)
  
  if (pendingError) {
    console.error('Error checking for duplicates:', pendingError.message)
    return []
  }
  
  return pendingDuplicates || []
}

// Parse structured feedback from admin_notes
function parseStructuredFeedback(adminNotes: string): string[] {
  if (!adminNotes) return []
  
  // Extract tags before the first dash or comma
  const tagSection = adminNotes.split(/[-–,]/)[0].trim()
  
  // Split by commas and/or spaces, then filter to valid tags
  return tagSection
    .split(/[,\s]+/)
    .map(tag => tag.trim().toUpperCase())
    .filter(tag => FEEDBACK_TAGS.includes(tag))
}

// Main handler function
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const url = new URL(req.url)
    const path = url.pathname.split('/').pop() || ''
    
    // Check if user is an admin
    const isUserAdmin = await isAdmin(supabaseAdmin, req.headers.get('Authorization') || '')
    
    if (!isUserAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized. Admin access required.' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    
    // Handle different routes
    switch (path) {
      case 'pending': {
        // GET /admin-review/pending - List pending shows with quality scores
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        // Parse query params
        const params = url.searchParams
        const limit = parseInt(params.get('limit') || '50')
        const offset = parseInt(params.get('offset') || '0')
        const source = params.get('source') || null
        const minScore = parseInt(params.get('minScore') || '0')
        const maxScore = parseInt(params.get('maxScore') || '100')
        
        // Get pending shows
        let query = supabaseAdmin
          .from('scraped_shows_pending')
          .select('*')
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1)
        
        if (source) {
          query = query.eq('source_url', source)
        }
        
        const { data: pendingShows, error } = await query
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Calculate quality scores and find duplicates
        const showsWithScores = await Promise.all(pendingShows.map(async (show: PendingShow) => {
          const qualityScore = calculateQualityScore(show)
          const duplicates = await findPotentialDuplicates(supabaseAdmin, show)
          
          return {
            ...show,
            quality: qualityScore,
            duplicates: duplicates.map(d => ({
              id: d.id,
              name: d.raw_payload.name,
              startDate: d.raw_payload.startDate,
              source_url: d.source_url
            }))
          }
        }))
        
        // Filter by score if needed
        const filteredShows = showsWithScores.filter(
          show => show.quality.score >= minScore && show.quality.score <= maxScore
        )
        
        // Get total count for pagination
        const { count, error: countError } = await supabaseAdmin
          .from('scraped_shows_pending')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'PENDING')
        
        if (countError) {
          console.error('Error getting count:', countError.message)
        }
        
        return new Response(JSON.stringify({ 
          shows: filteredShows,
          pagination: {
            total: count || 0,
            limit,
            offset,
            hasMore: (offset + limit) < (count || 0)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      case 'stats': {
        // GET /admin-review/stats - Get feedback statistics
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        // Parse query params
        const params = url.searchParams
        const days = parseInt(params.get('days') || '7')
        
        // Get feedback stats
        const { data: feedbackData, error: feedbackError } = await supabaseAdmin.rpc(
          'get_feedback_stats',
          { days_param: days }
        )
        
        if (feedbackError) {
          return new Response(JSON.stringify({ error: feedbackError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Get source stats
        const { data: sourceData, error: sourceError } = await supabaseAdmin.rpc(
          'get_source_stats',
          { days_param: days }
        )
        
        if (sourceError) {
          return new Response(JSON.stringify({ error: sourceError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        return new Response(JSON.stringify({ 
          feedback: feedbackData || [],
          sources: sourceData || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      case 'approve': {
        // POST /admin-review/approve - Approve a show
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        const body = await req.json()
        const { id, feedback = '' } = body
        
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing required field: id' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        
        // Start a transaction
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser()
        if (userError) {
          return new Response(JSON.stringify({ error: userError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Update the show status
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('scraped_shows_pending')
          .update({
            status: 'APPROVED',
            admin_notes: feedback,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Log the feedback
        const { error: feedbackError } = await supabaseAdmin
          .from('admin_feedback')
          .insert({
            pending_id: id,
            admin_id: userData.user.id,
            action: 'approve',
            feedback
          })
        
        if (feedbackError) {
          console.error('Error logging feedback:', feedbackError.message)
        }
        
        // Call the normalizer function to process the approved show
        const { data: normalizerData, error: normalizerError } = await supabaseAdmin.rpc('normalizer')
        
        if (normalizerError) {
          console.error('Error calling normalizer:', normalizerError.message)
        }
        
        return new Response(JSON.stringify({ 
          message: 'Show approved successfully',
          show: updateData?.[0] || null,
          normalizer: normalizerData || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      case 'reject': {
        // POST /admin-review/reject - Reject a show
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        const body = await req.json()
        const { id, feedback = '' } = body
        
        if (!id) {
          return new Response(JSON.stringify({ error: 'Missing required field: id' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        
        // Parse structured feedback tags
        const feedbackTags = parseStructuredFeedback(feedback)
        
        // Get user data
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser()
        if (userError) {
          return new Response(JSON.stringify({ error: userError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Update the show status
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('scraped_shows_pending')
          .update({
            status: 'REJECTED',
            admin_notes: feedback,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Log the feedback
        const { error: feedbackError } = await supabaseAdmin
          .from('admin_feedback')
          .insert({
            pending_id: id,
            admin_id: userData.user.id,
            action: 'reject',
            feedback
          })
        
        if (feedbackError) {
          console.error('Error logging feedback:', feedbackError.message)
        }
        
        return new Response(JSON.stringify({ 
          message: 'Show rejected successfully',
          show: updateData?.[0] || null,
          parsedTags: feedbackTags
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      case 'edit': {
        // POST /admin-review/edit - Edit and approve a show
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        const body = await req.json()
        const { id, raw_payload, feedback = '' } = body
        
        if (!id || !raw_payload) {
          return new Response(JSON.stringify({ error: 'Missing required fields: id and raw_payload' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        
        // Get user data
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser()
        if (userError) {
          return new Response(JSON.stringify({ error: userError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Update the show with edited data and approve
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('scraped_shows_pending')
          .update({
            raw_payload,
            status: 'APPROVED',
            admin_notes: feedback,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Log the feedback
        const { error: feedbackError } = await supabaseAdmin
          .from('admin_feedback')
          .insert({
            pending_id: id,
            admin_id: userData.user.id,
            action: 'edit',
            feedback
          })
        
        if (feedbackError) {
          console.error('Error logging feedback:', feedbackError.message)
        }
        
        // Call the normalizer function to process the approved show
        const { data: normalizerData, error: normalizerError } = await supabaseAdmin.rpc('normalizer')
        
        if (normalizerError) {
          console.error('Error calling normalizer:', normalizerError.message)
        }
        
        return new Response(JSON.stringify({ 
          message: 'Show edited and approved successfully',
          show: updateData?.[0] || null,
          normalizer: normalizerData || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      case 'batch': {
        // POST /admin-review/batch - Batch operations
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        const body = await req.json()
        const { action, ids, feedback = '' } = body
        
        if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
          return new Response(JSON.stringify({ error: 'Missing required fields: action and ids array' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        
        // Validate action
        if (!['approve', 'reject'].includes(action)) {
          return new Response(JSON.stringify({ error: 'Invalid action. Must be "approve" or "reject"' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          })
        }
        
        // Get user data
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser()
        if (userError) {
          return new Response(JSON.stringify({ error: userError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Update shows status
        const status = action === 'approve' ? 'APPROVED' : 'REJECTED'
        const { data: updateData, error: updateError } = await supabaseAdmin
          .from('scraped_shows_pending')
          .update({
            status,
            admin_notes: feedback,
            reviewed_at: new Date().toISOString()
          })
          .in('id', ids)
          .select()
        
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        // Log feedback for each show
        const feedbackEntries = ids.map(id => ({
          pending_id: id,
          admin_id: userData.user.id,
          action: action === 'approve' ? 'bulk_approve' : 'bulk_reject',
          feedback
        }))
        
        const { error: feedbackError } = await supabaseAdmin
          .from('admin_feedback')
          .insert(feedbackEntries)
        
        if (feedbackError) {
          console.error('Error logging feedback:', feedbackError.message)
        }
        
        // Call the normalizer function if approving
        let normalizerResult = null
        if (action === 'approve') {
          const { data: normalizerData, error: normalizerError } = await supabaseAdmin.rpc('normalizer')
          
          if (normalizerError) {
            console.error('Error calling normalizer:', normalizerError.message)
          } else {
            normalizerResult = normalizerData
          }
        }
        
        return new Response(JSON.stringify({ 
          message: `Batch ${action} completed successfully for ${updateData?.length || 0} shows`,
          shows: updateData || [],
          normalizer: normalizerResult
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      case 'duplicates': {
        // GET /admin-review/duplicates - Find potential duplicates
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          })
        }
        
        // Find potential duplicates within pending shows
        const { data: duplicates, error } = await supabaseAdmin.rpc('find_duplicate_pending_shows')
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        return new Response(JSON.stringify({ 
          duplicates: duplicates || []
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      default:
        // Return API documentation for root path
        return new Response(JSON.stringify({ 
          message: 'Admin Review API',
          endpoints: [
            { method: 'GET', path: '/admin-review/pending', description: 'List pending shows with quality scores' },
            { method: 'GET', path: '/admin-review/stats', description: 'Get feedback statistics' },
            { method: 'GET', path: '/admin-review/duplicates', description: 'Find potential duplicates' },
            { method: 'POST', path: '/admin-review/approve', description: 'Approve a show' },
            { method: 'POST', path: '/admin-review/reject', description: 'Reject a show' },
            { method: 'POST', path: '/admin-review/edit', description: 'Edit and approve a show' },
            { method: 'POST', path: '/admin-review/batch', description: 'Batch operations' }
          ]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
    }
  } catch (e) {
    const error = e as Error
    console.error('Admin review function failed:', error.message, error.stack)
    
    return new Response(JSON.stringify({ 
      error: `Admin review function failed: ${error.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
