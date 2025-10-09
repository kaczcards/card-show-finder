import { redirect } from 'next/navigation'

/**
 * Root Page - Redirects to Admin Dashboard
 * 
 * This is the homepage that immediately redirects authenticated users
 * to the admin dashboard. Unauthenticated users will be redirected
 * to the login page by the admin layout.
 */
export default function Home() {
  redirect('/admin/dashboard')
}
