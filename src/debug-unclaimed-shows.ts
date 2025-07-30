// Temporary debug file to test the useUnclaimedShows hook
import { showSeriesService } from './services/showSeriesService';

async function testUnclaimedShowsDataHandling() {
  // eslint-disable-next-line no-console
console.warn('---- STARTING DEBUG TEST ----');
  
  try {
    // Test getAllShowSeries function
    // eslint-disable-next-line no-console
console.warn('[TEST] Testing getAllShowSeries...');
    const unclaimedSeries = await showSeriesService.getAllShowSeries({
      organizerId: undefined
    });
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Value of unclaimedSeries:', unclaimedSeries);
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Type of unclaimedSeries:', Array.isArray(unclaimedSeries); ? 'array' : typeof unclaimedSeries);
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Length of unclaimedSeries:', Array.isArray(unclaimedSeries); ? unclaimedSeries.length : 'N/A');
    
    // Ensure it's an array even if empty
    const safeSeries = unclaimedSeries || [];
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Safe series is array:', Array.isArray(safeSeries););
    
    // Test getUnclaimedShows function
    // eslint-disable-next-line no-console
console.warn('[TEST] Testing getUnclaimedShows...');
    const unclaimedShows = await showSeriesService.getUnclaimedShows();
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Value of unclaimedShows:', unclaimedShows);
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Type of unclaimedShows:', Array.isArray(unclaimedShows); ? 'array' : typeof unclaimedShows);
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Length of unclaimedShows:', Array.isArray(unclaimedShows); ? unclaimedShows.length : 'N/A');
    
    // Ensure it's an array even if empty
    const safeShows = unclaimedShows || [];
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Safe shows is array:', Array.isArray(safeShows););
    
    // Test the combined data
    // eslint-disable-next-line no-console
console.warn('[TEST] Testing combined data...');
    // This would crash if either unclaimedSeries or unclaimedShows is undefined
    const combinedItems = [
      ...safeSeries,
      ...safeShows
    ];
    // eslint-disable-next-line no-console
console.warn('[DEBUG] Combined items length:', combinedItems.length);
    
    // eslint-disable-next-line no-console
console.warn('---- DEBUG TEST SUCCESSFUL ----');
  } catch (error) {
    console.error('[ERROR] Debug test failed:', error);
  }
}

// Export for use in other modules if needed
export { testUnclaimedShowsDataHandling };
