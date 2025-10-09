'use client'

/**
 * ShowsList Client Component
 * 
 * Client-side component for interactive show list with modal functionality.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReviewModal from './ReviewModal'

interface Show {
  id: string
  title: string
  location: string
  venue_name?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  start_date: string
  end_date?: string
  description?: string
  scraped_organizer_name?: string
  scraped_organizer_email?: string
  scraped_organizer_phone?: string
  scraped_website_url?: string
  confidence_score?: number
}

interface ShowsListProps {
  shows: Show[]
}

export default function ShowsList({ shows }: ShowsListProps) {
  const router = useRouter()
  const [selectedShow, setSelectedShow] = useState<Show | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [rejectingShowId, setRejectingShowId] = useState<string | null>(null)

  const handleReview = (show: Show) => {
    setSelectedShow(show)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedShow(null)
  }

  const handleQuickReject = async (showId: string, showTitle: string) => {
    if (!confirm(`Are you sure you want to reject "${showTitle}"? This cannot be undone.`)) {
      return
    }

    setRejectingShowId(showId)

    try {
      const response = await fetch('/api/shows/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: showId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject show')
      }

      // Refresh to update the list
      router.refresh()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setRejectingShowId(null)
    }
  }

  if (shows.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No pending shows</h3>
        <p className="mt-1 text-sm text-gray-500">
          All shows have been reviewed. Great job!
        </p>
      </div>
    )
  }

  return (
    <>
      <ul role="list" className="divide-y divide-gray-200">
        {shows.map((show) => {
          const confidenceScore = show.confidence_score || 0
          const confidenceColor = 
            confidenceScore >= 80 ? 'bg-green-100 text-green-800' :
            confidenceScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'

          return (
            <li key={show.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {show.title}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${confidenceColor}`}>
                      {confidenceScore}% confidence
                    </span>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4 flex-wrap">
                    <span className="flex items-center">
                      <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {show.location}
                    </span>
                    <span className="flex items-center">
                      <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(show.start_date).toLocaleDateString()}
                    </span>
                    {show.scraped_organizer_email && (
                      <span className="flex items-center">
                        <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        {show.scraped_organizer_email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-6 flex-shrink-0 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => handleReview(show)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReject(show.id, show.title)}
                    disabled={rejectingShowId === show.id}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rejectingShowId === show.id ? 'Rejecting...' : 'Quick Reject'}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Review Modal */}
      {selectedShow && (
        <ReviewModal
          show={selectedShow}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
