// Temporary debug file to test the useUnclaimedShows hook
import { showSeriesService } from '../../src/services/showSeriesService';

/**
 * Quick debug helper for validating the data returned by the showSeriesService.
 * It purposefully logs out the shape and size of the returned arrays so we can
 * ensure downstream hooks (e.g. useUnclaimedShows) won’t break on `undefined`.
 */
async function testUnclaimedShowsDataHandling() {
  console.warn('---- STARTING DEBUG TEST ----');
  
  try {
    // Test getAllShowSeries function
    console.warn('[_TEST] Testing getAllShowSeries...');
    const unclaimedSeries = await showSeriesService.getAllShowSeries({
      organizerId: undefined
    });
    console.warn('[_DEBUG] Value of unclaimedSeries:', unclaimedSeries);
    console.warn(
      '[_DEBUG] Type of unclaimedSeries:',
      Array.isArray(unclaimedSeries) ? 'array' : typeof unclaimedSeries,
    );
    console.warn(
      '[_DEBUG] Length of unclaimedSeries:',
      Array.isArray(unclaimedSeries) ? unclaimedSeries.length : 'N/A',
    );
    
    // Ensure it's an array even if empty
    const safeSeries = unclaimedSeries || [];
    console.warn('[_DEBUG] Safe series is array:', Array.isArray(safeSeries));
    
    // Test getUnclaimedShows function
    console.warn('[_TEST] Testing getUnclaimedShows...');
    const unclaimedShows = await showSeriesService.getUnclaimedShows();
    console.warn('[_DEBUG] Value of unclaimedShows:', unclaimedShows);
    console.warn(
      '[_DEBUG] Type of unclaimedShows:',
      Array.isArray(unclaimedShows) ? 'array' : typeof unclaimedShows,
    );
    console.warn(
      '[_DEBUG] Length of unclaimedShows:',
      Array.isArray(unclaimedShows) ? unclaimedShows.length : 'N/A',
    );
    
    // Ensure it's an array even if empty
    const safeShows = unclaimedShows || [];
    console.warn('[_DEBUG] Safe shows is array:', Array.isArray(safeShows));
    
    // Test the combined data
    console.warn('[_TEST] Testing combined data...');
    // This would crash if either unclaimedSeries or unclaimedShows is undefined
    const combinedItems = [
      ...safeSeries,
      ...safeShows
    ];
    console.warn('[_DEBUG] Combined items length:', combinedItems.length);
    
    console.warn('---- DEBUG TEST SUCCESSFUL ----');
  } catch (error) {
    console.error('[_ERROR] Debug test failed:', error);
  }
}

// Export for use in other modules if needed
export { testUnclaimedShowsDataHandling };
