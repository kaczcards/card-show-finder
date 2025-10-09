'use client'

/**
 * RefreshButton Component
 * 
 * Client-side button to refresh the current page data.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RefreshButton() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    router.refresh()
    // Reset the loading state after a short delay
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg 
        className={`-ml-1 mr-2 h-5 w-5 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`}
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  )
}
