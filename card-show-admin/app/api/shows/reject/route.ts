/**
 * API Route: Reject Show
 * 
 * Deletes a pending show from the database.
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Show ID is required' }, { status: 400 })
    }

    // Delete the show
    const { error: deleteError } = await supabase
      .from('shows')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error rejecting show:', deleteError)
      return NextResponse.json(
        { error: 'Failed to reject show', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Show rejected and deleted',
    })
  } catch (error: any) {
    console.error('Unexpected error in reject route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
