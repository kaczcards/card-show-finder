/**
 * API Route: Approve Show
 * 
 * Updates a pending show with admin corrections and sets status to ACTIVE.
 * This triggers the learning loop in the backend.
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
    const { id, ...showData } = body

    if (!id) {
      return NextResponse.json({ error: 'Show ID is required' }, { status: 400 })
    }

    // Update the show with corrections and set status to ACTIVE
    const { data: updatedShow, error: updateError } = await supabase
      .from('shows')
      .update({
        ...showData,
        status: 'ACTIVE',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error approving show:', updateError)
      return NextResponse.json(
        { error: 'Failed to approve show', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      show: updatedShow,
      message: 'Show approved successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error in approve route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
