/**
 * Admin screens index file
 * 
 * This file exports the AdminMapScreen component for easy importing
 * throughout the application.
 */

import AdminMapScreen from './AdminMapScreen';
import GenerateReferralCodeScreen from './GenerateReferralCodeScreen';

// Re-export with the correct name (automation added the leading underscore by mistake)
export { AdminMapScreen, GenerateReferralCodeScreen };
export default { AdminMapScreen, GenerateReferralCodeScreen };
