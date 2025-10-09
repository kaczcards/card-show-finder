/**
 * Auth Callback Handler
 * 
 * Handles OAuth callbacks and password reset confirmations from Supabase
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')

  if (code) {
    // OAuth callback
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  if (token_hash && type) {
    // Password reset or email verification
    const supabase = createRouteHandlerClient({ cookies })

    if (type === 'recovery') {
      // Password reset - redirect to password update page
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/reset-password?token_hash=${token_hash}&type=${type}`
      )
    }

    // For other types (email confirmation, etc.), verify the hash
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (error) {
      console.error('Error verifying token:', error)
      return NextResponse.redirect(`${requestUrl.origin}/login?error=verification_failed`)
    }
  }

  // Redirect to admin dashboard after successful auth
  return NextResponse.redirect(`${requestUrl.origin}/admin/dashboard`)
}
