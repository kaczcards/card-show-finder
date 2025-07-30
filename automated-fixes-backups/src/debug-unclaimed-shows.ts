// Temporary debug file to test the useUnclaimedShows hook
import { showSeriesService } from './services/showSeriesService';

async function testUnclaimedShowsDataHandling() {
  console.log('---- STARTING DEBUG TEST ----');
  
  try {
    // Test getAllShowSeries function
    console.log('[TEST] Testing getAllShowSeries...');
    const unclaimedSeries = await showSeriesService.getAllShowSeries({
      organizerId: undefined
    });
    console.log('[DEBUG] Value of unclaimedSeries:', unclaimedSeries);
    console.log('[DEBUG] Type of unclaimedSeries:', Array.isArray(unclaimedSeries) ? 'array' : typeof unclaimedSeries);
    console.log('[DEBUG] Length of unclaimedSeries:', Array.isArray(unclaimedSeries) ? unclaimedSeries.length : 'N/A');
    
    // Ensure it's an array even if empty
    const safeSeries = unclaimedSeries || [];
    console.log('[DEBUG] Safe series is array:', Array.isArray(safeSeries));
    
    // Test getUnclaimedShows function
    console.log('[TEST] Testing getUnclaimedShows...');
    const unclaimedShows = await showSeriesService.getUnclaimedShows();
    console.log('[DEBUG] Value of unclaimedShows:', unclaimedShows);
    console.log('[DEBUG] Type of unclaimedShows:', Array.isArray(unclaimedShows) ? 'array' : typeof unclaimedShows);
    console.log('[DEBUG] Length of unclaimedShows:', Array.isArray(unclaimedShows) ? unclaimedShows.length : 'N/A');
    
    // Ensure it's an array even if empty
    const safeShows = unclaimedShows || [];
    console.log('[DEBUG] Safe shows is array:', Array.isArray(safeShows));
    
    // Test the combined data
    console.log('[TEST] Testing combined data...');
    // This would crash if either unclaimedSeries or unclaimedShows is undefined
    const combinedItems = [
      ...safeSeries,
      ...safeShows
    ];
    console.log('[DEBUG] Combined items length:', combinedItems.length);
    
    console.log('---- DEBUG TEST SUCCESSFUL ----');
  } catch (error) {
    console.error('[ERROR] Debug test failed:', error);
  }
}

// Export for use in other modules if needed
export { testUnclaimedShowsDataHandling };
