import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getPaginatedShows,
  PaginatedShowsParams,
  PaginatedShowsResult,
} from '../services/showService';
import { Show, ShowFilters, Coordinates } from '../types';

/**
 * Interface for the parameters accepted by useInfiniteShows hook
 */
export interface InfiniteShowsParams extends ShowFilters {
  /**
   * User's current coordinates (required for geo-filtering)
   */
  coordinates: Coordinates;
  
  /**
   * Number of shows to fetch per page
   * @default 20
   */
  pageSize?: number;
  
  /**
   * Whether to enable the query automatically
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result interface returned by useInfiniteShows hook
 */
export interface InfiniteShowsResult {
  /**
   * Flattened array of all shows across all loaded pages
   */
  shows: Show[];
  
  /**
   * Total count of shows matching the filter criteria
   */
  totalCount: number;
  
  /**
   * Whether there are more pages that can be loaded
   */
  hasNextPage: boolean;
  
  /**
   * Function to fetch the next page of shows
   */
  fetchNextPage: () => Promise<void>;
  
  /**
   * Function to refresh all data
   */
  refresh: () => Promise<void>;
  
  /**
   * Whether the initial data is loading
   */
  isLoading: boolean;
  
  /**
   * Whether more data is being fetched
   */
  isFetchingNextPage: boolean;
  
  /**
   * Whether a refresh is in progress
   */
  isRefreshing: boolean;
  
  /**
   * Error message if any
   */
  error: string | null;
}

/**
 * Custom hook that uses React Query's useInfiniteQuery to implement infinite scrolling
 * for the shows list on the home screen.
 * 
 * @param params - Filtering parameters and coordinates
 * @returns An object with shows data, loading states, and functions to fetch more data
 */
export const useInfiniteShows = (params: InfiniteShowsParams): InfiniteShowsResult => {
  const {
    coordinates,
    radius = 25,
    startDate = new Date(),
    endDate = new Date(new Date().setDate(new Date().getDate() + 30)),
    maxEntryFee,
    features,
    categories,
    pageSize = 20,
    enabled = true,
  } = params;
  
  /**
   * ------------------------------------------------------------------
   * Coordinate handling
   * ------------------------------------------------------------------
   * HomeScreen (and potentially other callers) may pass `null` or an
   * incomplete coordinates object while location permissions are being
   * resolved.  Previously we threw an error, which prevented the hook
   * from ever executing and left the UI in an empty-state loop.
   *
   * Instead, we now:
   *   1. Detect whether the incoming coordinates are valid numbers
   *   2. If invalid, fall back to a sensible default (Carmel, IN) which
   *      is seeded with real shows in seed data
   *   3. Log a debug message so developers can see when the fallback
   *      path is taken
   */
  const isValidCoordinates =
    coordinates &&
    typeof coordinates.latitude === 'number' &&
    typeof coordinates.longitude === 'number' &&
    !Number.isNaN(coordinates.latitude) &&
    !Number.isNaN(coordinates.longitude);

  const effectiveCoordinates: Coordinates = isValidCoordinates
    ? coordinates
    : { latitude: 39.9784, longitude: -86.118 }; // Carmel, IN

  if (!isValidCoordinates) {
    // eslint-disable-next-line no-console
    console.debug(
      '[useInfiniteShows] Invalid or missing coordinates supplied. ' +
        'Falling back to default coordinates (Carmel, IN).',
      coordinates
    );
  }
  
  // Set up the infinite query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error: queryError,
    refetch,
  } = useInfiniteQuery<PaginatedShowsResult, Error>({
    queryKey: ['shows', 'infinite', { 
      coordinates: effectiveCoordinates, 
      radius, 
      startDate, 
      endDate, 
      maxEntryFee, 
      features, 
      categories, 
      pageSize 
    }],
    // Start pagination at page 1
    initialPageParam: 1,
    queryFn: async ({ pageParam = 1 }) => {
      // Prepare parameters for the paginated shows query
      const page = Number(pageParam) || 1;
      const queryParams: PaginatedShowsParams = {
        latitude: effectiveCoordinates.latitude,
        longitude: effectiveCoordinates.longitude,
        radius,
        startDate,
        endDate,
        maxEntryFee,
        features,
        categories,
        pageSize,
        page,
      };
      
      // Call the service function to get paginated shows
      const result = await getPaginatedShows(queryParams);
      
      // If there's an error, throw it so React Query can handle it
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    },
    getNextPageParam: (lastPage: PaginatedShowsResult) => {
      // If we've reached the last page, return undefined (stops infinite loading)
      if (lastPage.pagination.currentPage >= lastPage.pagination.totalPages) {
        return undefined;
      }
      
      // Otherwise, return the next page number
      return lastPage.pagination.currentPage + 1;
    },
    enabled,
    staleTime: 60 * 1000, // Consider data fresh for 1 minute
    refetchOnWindowFocus: false,
  });
  
  // Function to refresh data
  const refresh = async (): Promise<void> => {
    await refetch();
  };
  
  // Flatten the pages of shows into a single array
  const flattenedShows =
    data?.pages.flatMap((page: PaginatedShowsResult) => page.data) || [];
  
  // Get the total count from the first page (or 0 if no data)
  const totalCount = data?.pages[0]?.pagination.totalCount || 0;
  
  // Extract error message if any
  const errorMessage = isError ? (queryError as Error)?.message || 'Failed to load shows' : null;
  
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

export default useInfiniteShows;
