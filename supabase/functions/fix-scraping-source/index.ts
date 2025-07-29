import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Create a Supabase client with the service role key for admin access
const getSupabaseAdmin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

// Main handler function
serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    console.log('Starting fix-scraping-source function...');
    const startTime = Date.now();
    
    const supabaseAdmin = getSupabaseAdmin();
    const results = {
      beforeUpdate: null,
      updateResult: null,
      afterUpdate: null,
      pendingShowsStats: null,
      recentShows: null,
      showsBySource: null,
      tablesExist: {
        scraped_shows_pending: false,
        scraping_sources: false
      }
    };
    
    // 1. Check if tables exist
    const { data: tableCheck, error: tableError } = await supabaseAdmin.rpc(
      'check_tables_exist',
      { tables: ['scraped_shows_pending', 'scraping_sources'] }
    );
    
    if (tableError) {
      console.error('Error checking tables:', tableError.message);
      
      // Fallback method if RPC doesn't exist
      const { data: tables, error: tablesError } = await supabaseAdmin
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public')
        .in('tablename', ['scraped_shows_pending', 'scraping_sources']);
        
      if (!tablesError && tables) {
        results.tablesExist.scraped_shows_pending = tables.some(t => t.tablename === 'scraped_shows_pending');
        results.tablesExist.scraping_sources = tables.some(t => t.tablename === 'scraping_sources');
      }
    } else if (tableCheck) {
      results.tablesExist = tableCheck;
    }
    
    // 2. Get current scraping sources (before update)
    const { data: beforeData, error: beforeError } = await supabaseAdmin
      .from('scraping_sources')
      .select('*')
      .order('priority_score', { ascending: false });
      
    if (beforeError) {
      console.error('Error fetching scraping sources (before):', beforeError.message);
    } else {
      results.beforeUpdate = beforeData;
    }
    
    // 3. Update the incorrect Sports Collectors Digest URL
    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('scraping_sources')
      .update({
        url: 'https://sportscollectorsdigest.com/',
        updated_at: new Date().toISOString(),
        error_streak: 0,
        last_error_at: null
      })
      .eq('url', 'https://www.sportscollectorsdigest.com/events/card-shows/')
      .select();
      
    if (updateError) {
      console.error('Error updating scraping source:', updateError.message);
    } else {
      results.updateResult = updateData;
    }
    
    // 4. Get updated scraping sources (after update)
    const { data: afterData, error: afterError } = await supabaseAdmin
      .from('scraping_sources')
      .select('*')
      .order('priority_score', { ascending: false });
      
    if (afterError) {
      console.error('Error fetching scraping sources (after):', afterError.message);
    } else {
      results.afterUpdate = afterData;
    }
    
    // 5. Get pending shows statistics
    const { data: statsData, error: statsError } = await supabaseAdmin
      .from('scraped_shows_pending')
      .select('status, created_at')
      .order('created_at', { ascending: true });
      
    if (statsError) {
      console.error('Error fetching pending shows stats:', statsError.message);
    } else if (statsData) {
      const pendingCount = statsData.filter(s => s.status === 'PENDING').length;
      const approvedCount = statsData.filter(s => s.status === 'APPROVED').length;
      const rejectedCount = statsData.filter(s => s.status === 'REJECTED').length;
      
      let oldestDate = null;
      let newestDate = null;
      
      if (statsData.length > 0) {
        oldestDate = statsData[0].created_at;
        newestDate = statsData[statsData.length - 1].created_at;
      }
      
      results.pendingShowsStats = {
        totalShows: statsData.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        oldestShow: oldestDate,
        newestShow: newestDate
      };
    }
    
    // 6. Get most recent shows
    const { data: recentData, error: recentError } = await supabaseAdmin
      .from('scraped_shows_pending')
      .select('id, status, source_url, raw_payload, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (recentError) {
      console.error('Error fetching recent shows:', recentError.message);
    } else {
      // Format the recent shows data for better readability
      results.recentShows = recentData?.map(show => ({
        id: show.id,
        status: show.status,
        source_url: show.source_url,
        show_name: show.raw_payload?.name,
        city: show.raw_payload?.city,
        state: show.raw_payload?.state,
        start_date: show.raw_payload?.startDate,
        created_at: show.created_at
      }));
    }
    
    // 7. Get shows by source URL
    const { data: sourceData, error: sourceError } = await supabaseAdmin
      .from('scraped_shows_pending')
      .select('source_url, status, created_at');
      
    if (sourceError) {
      console.error('Error fetching shows by source:', sourceError.message);
    } else if (sourceData) {
      // Group by source URL
      const sourceGroups = {};
      
      sourceData.forEach(show => {
        if (!sourceGroups[show.source_url]) {
          sourceGroups[show.source_url] = {
            source_url: show.source_url,
            total_shows: 0,
            pending_shows: 0,
            approved_shows: 0,
            rejected_shows: 0,
            first_scraped: null,
            last_scraped: null
          };
        }
        
        const group = sourceGroups[show.source_url];
        group.total_shows++;
        
        if (show.status === 'PENDING') group.pending_shows++;
        if (show.status === 'APPROVED') group.approved_shows++;
        if (show.status === 'REJECTED') group.rejected_shows++;
        
        const createdAt = new Date(show.created_at);
        
        if (!group.first_scraped || createdAt < new Date(group.first_scraped)) {
          group.first_scraped = show.created_at;
        }
        
        if (!group.last_scraped || createdAt > new Date(group.last_scraped)) {
          group.last_scraped = show.created_at;
        }
      });
      
      results.showsBySource = Object.values(sourceGroups)
        .sort((a, b) => b.total_shows - a.total_shows);
    }
    
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Prepare summary of what was fixed
    const fixSummary = {
      urlFixed: results.updateResult && results.updateResult.length > 0,
      oldUrl: 'https://www.sportscollectorsdigest.com/events/card-shows/',
      newUrl: 'https://sportscollectorsdigest.com/',
      affectedRows: results.updateResult?.length || 0,
      nextSteps: "Now run the scraper-agent function to test if shows are extracted correctly"
    };
    
    return new Response(JSON.stringify({ 
      message: `URL fix and diagnostics completed in ${elapsedSeconds}s.`,
      fixSummary,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    const error = e as Error;
    console.error('Fix scraping source failed:', error.message, error.stack);
    
    return new Response(JSON.stringify({ 
      error: `Fix scraping source failed: ${error.message}` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
