import { useInfiniteShows, InfiniteShowsParams, InfiniteShowsResult } from './useInfiniteShows';
import { useShowsInfiniteQuery } from './useShowsAdvancedQuery.rpc';
import { Show } from '../types';

/**
 * Unified hook for infinite shows fetching that chooses between:
 * 1. RPC-based advanced query (when keyword or dealerCardTypes are used)
 * 2. Legacy client-side filtering (for basic filtering)
 * 
 * Maintains the same parameter and result interface as useInfiniteShows
 * for seamless integration with existing components.
 * 
 * @param params - Filtering parameters and coordinates
 * @returns An object with shows data, loading states, and functions to fetch more data
 */
export const useUnifiedInfiniteShows = (params: InfiniteShowsParams): InfiniteShowsResult => {
  // Determine if we should use the RPC path
  const shouldUseRpc = 
    (typeof params.keyword === 'string' && params.keyword.trim().length > 0) || 
    (Array.isArray(params.dealerCardTypes) && params.dealerCardTypes.length > 0);
  
  // If no advanced filtering is needed, use the legacy path
  if (!shouldUseRpc) {
    return useInfiniteShows(params);
  }
  
  // Otherwise, use the RPC path with advanced filtering capabilities
  const {
    coordinates,
    radius = 25,
    startDate = new Date(),
    endDate = new Date(new Date().setDate(new Date().getDate() + 30)),
    maxEntryFee,
    features,
    categories,
    keyword,
    dealerCardTypes,
    pageSize = 20,
    enabled = true,
  } = params;

  // Convert features array to Record<string, boolean> if needed
  const featuresRecord: Record<string, boolean> = {};
  if (Array.isArray(features) && features.length > 0) {
    features.forEach(feature => {
      featuresRecord[feature] = true;
    });
  }

  // Use the RPC-based infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useShowsInfiniteQuery(
    {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      radius,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      maxEntryFee,
      categories,
      features: Object.keys(featuresRecord).length > 0 ? featuresRecord : undefined,
      keyword,
      dealerCardTypes,
      pageSize,
      useLegacyFallback: true, // Enable fallback to ensure we always get results
    },
    // Cast options as any to bypass strict generic type requirements
    { enabled } as any
  );
  
  // Safely access pages to avoid TS complaints about `.pages`
  const pages = (data as any)?.pages as Array<{ shows: Show[]; pagination: any }> | undefined;

  // Flatten the pages of shows into a single array
  const flattenedShows: Show[] = pages ? pages.flatMap((page: any) => page.shows) : [];
  
  // Get the total count from the first page (or 0 if no data)
  const totalCount = pages?.[0]?.pagination?.totalCount || 0;
  
  // Extract error message if any
  const errorMessage = isError ? (queryError as Error)?.message || 'Failed to load shows' : null;
  
  // Create a refresh function that wraps refetch
  const refresh = async (): Promise<void> => {
    await refetch();
  };
  
  return {
    shows: flattenedShows,
    totalCount,
    hasNextPage: !!hasNextPage,
    fetchNextPage: async () => {
      if (hasNextPage && !isFetchingNextPage) {
        await fetchNextPage();
      }
    },
    refresh,
    isLoading,
    isFetchingNextPage,
    isRefreshing: false, // This would need to be tracked separately if needed
    error: errorMessage,
  };
};

export default useUnifiedInfiniteShows;
