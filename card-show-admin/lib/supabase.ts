/**
 * Supabase Client Configuration
 * 
 * This file sets up the Supabase client for the Next.js application.
 * It provides both client-side and server-side Supabase instances.
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

/**
 * Client-side Supabase client
 * Use this in Client Components (components with 'use client')
 */
export const createClient = () => {
  return createClientComponentClient<Database>()
}

/**
 * Server-side Supabase client
 * Use this in Server Components and Server Actions
 */
export const createServerClient = () => {
  const { cookies } = require('next/headers')
  const cookieStore = cookies()
  return createServerComponentClient<Database>({ cookies: () => cookieStore })
}
