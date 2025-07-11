import { useInfiniteQuery } from '@tanstack/react-query';
import { getPaginatedShows, PaginatedShowsParams } from '../services/showService';
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
  
  // Validate that coordinates are provided
  if (!coordinates || typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number') {
    throw new Error('Valid coordinates are required for useInfiniteShows');
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
  } = useInfiniteQuery({
    queryKey: ['shows', 'infinite', { 
      coordinates, 
      radius, 
      startDate, 
      endDate, 
      maxEntryFee, 
      features, 
      categories, 
      pageSize 
    }],
    queryFn: async ({ pageParam = 1 }) => {
      // Prepare parameters for the paginated shows query
      const queryParams: PaginatedShowsParams = {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        radius,
        startDate,
        endDate,
        maxEntryFee,
        features,
        categories,
        pageSize,
        page: pageParam,
      };
      
      // Call the service function to get paginated shows
      const result = await getPaginatedShows(queryParams);
      
      // If there's an error, throw it so React Query can handle it
      if (result.error) {
        throw new Error(result.error);
      }
      
      return result;
    },
    getNextPageParam: (lastPage) => {
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
  const flattenedShows = data?.pages.flatMap(page => page.data) || [];
  
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
