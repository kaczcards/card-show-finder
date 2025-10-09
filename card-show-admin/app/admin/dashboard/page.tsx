/**
 * Admin Dashboard Page
 * 
 * Main dashboard showing pending shows that need approval.
 * Displays shows scraped by the system with their confidence scores.
 */

import { createServerClient } from '@/lib/supabase'
import ShowsList from '@/components/ShowsList'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = createServerClient()

  // Fetch pending shows with scraped organizer data, ordered by confidence score
  const { data: shows, error } = await supabase
    .from('shows')
    .select('*')
    .eq('status', 'PENDING')
    .not('scraped_organizer_name', 'is', null)
    .order('confidence_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  const showCount = shows?.length || 0

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
          <p className="mt-2 text-sm text-gray-700">
            Review and approve shows scraped by the system
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <div className="inline-flex items-center rounded-md bg-purple-50 px-3 py-2">
            <span className="text-sm font-medium text-purple-800">
              {showCount} {showCount === 1 ? 'show' : 'shows'} pending
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Pending</dt>
                  <dd className="text-lg font-semibold text-gray-900">{showCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Low Confidence</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {shows?.filter(s => (s.confidence_score || 0) < 70).length || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">High Confidence</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {shows?.filter(s => (s.confidence_score || 0) >= 80).length || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Shows List */}
      <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
        {error && (
          <div className="p-4 bg-red-50 border-l-4 border-red-400">
            <p className="text-sm text-red-700">Error loading shows: {error.message}</p>
          </div>
        )}

        {!error && <ShowsList shows={shows || []} />}
      </div>
    </div>
  )
}
