/**
 * Admin Layout
 * 
 * Protected layout that wraps all admin pages.
 * - Checks authentication on the server
 * - Verifies admin role
 * - Provides navigation sidebar
 * - Redirects unauthenticated users to login
 */

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import AdminNav from '@/components/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', session.user.id)
    .single()

  if (error || !profile || profile.role.toLowerCase() !== 'admin') {
    // User is not admin, sign them out and redirect
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav user={session.user} profile={profile} />
      <main className="lg:pl-64">
        <div className="py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
