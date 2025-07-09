const fs = require('fs');
const path = require('path');

// Path to the ShowDetailScreen.tsx file
const filePath = path.join(__dirname, 'src', 'screens', 'ShowDetail', 'ShowDetailScreen.tsx');

// Read the current content of the file
let content = fs.readFileSync(filePath, 'utf8');

// Make the changes

// 1. Import organizerService
if (!content.includes("import * as organizerService from '../../services/organizerService';")) {
  content = content.replace(
    "import * as userRoleService from '../../services/userRoleService';",
    "import * as userRoleService from '../../services/userRoleService';\nimport * as organizerService from '../../services/organizerService';"
  );
}

// 2. Add state for show claiming
if (!content.includes('const [canClaimShow, setCanClaimShow] = useState(false);')) {
  content = content.replace(
    '// State for all participating dealers (formerly mvpDealers)\n  const [participatingDealers, setParticipatingDealers] = useState<any[]>([]);\n  const [loadingDealers, setLoadingDealers] = useState(false);',
    '// State for all participating dealers (formerly mvpDealers)\n  const [participatingDealers, setParticipatingDealers] = useState<any[]>([]);\n  const [loadingDealers, setLoadingDealers] = useState(false);\n\n  // State for show claiming\n  const [canClaimShow, setCanClaimShow] = useState(false);\n  const [isClaimingShow, setIsClaimingShow] = useState(false);\n  const [isCurrentUserOrganizer, setIsCurrentUserOrganizer] = useState(false);'
  );
}

// 3. Add logic to check if show can be claimed in fetchShowDetails
if (!content.includes('setIsCurrentUserOrganizer')) {
  content = content.replace(
    'setShow(data);',
    'setShow(data);\n        \n        // Determine if the current user is the organizer of this show\n        setIsCurrentUserOrganizer(user?.id === data.organizer_id);\n        \n        // Determine if the show can be claimed (no organizer assigned)\n        setCanClaimShow(isShowOrganizer && !data.organizer_id);'
  );
}

// 4. Add handleClaimShow function
if (!content.includes('handleClaimShow')) {
  content = content.replace(
    'const shareShow = async () => {',
    `/**
   * Handles claiming a show as an organizer
   */
  const handleClaimShow = async () => {
    if (!user || !isShowOrganizer) {
      Alert.alert('Permission Denied', 'You must be a Show Organizer to claim this show.');
      return;
    }

    try {
      setIsClaimingShow(true);
      
      const { success, error } = await organizerService.claimShow(showId, user.id);
      
      if (success) {
        Alert.alert(
          'Success!', 
          'You have successfully claimed this show. You can now manage it and respond to reviews.',
          [{ text: 'OK', onPress: () => fetchShowDetails() }]
        );
      } else {
        Alert.alert('Error', error || 'Failed to claim show. Please try again later.');
      }
    } catch (error: any) {
      console.error('Error claiming show:', error);
      Alert.alert('Error', 'An unexpected error occurred while claiming the show.');
    } finally {
      setIsClaimingShow(false);
    }
  };

  /**
   * Navigates to the edit show screen
   */
  const navigateToEditShow = () => {
    navigation.navigate('EditShow', { showId });
  };

  const shareShow = async () => {`
  );
}

// 5. Fix the entry fee text component error
content = content.replace(
  '<Text style={styles.infoText}>\n              Entry Fee: ${',
  '<Text style={styles.infoText}>\n              {`Entry Fee: ${');

content = content.replace(
  '}</Text>',
  '}`}</Text>');

// 6. Update Broadcast button to only show for current organizer or MVP dealer
content = content.replace(
  '{(isShowOrganizer || isMvpDealer) && (',
  '{(isCurrentUserOrganizer || isMvpDealer) && (');

// 7. Add claim show button
if (!content.includes('claimShowButton')) {
  content = content.replace(
    '{show.organizer_id && show.profiles && (',
    `{/* Show Claim Button for Show Organizers */}
        {isShowOrganizer && !isCurrentUserOrganizer && !show.organizer_id && (
          <TouchableOpacity
            style={styles.claimShowButton}
            onPress={handleClaimShow}
            disabled={isClaimingShow}
          >
            {isClaimingShow ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="flag" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
                <Text style={styles.claimButtonText}>Claim This Show</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {/* Edit Show Button for the organizer of this show */}
        {isCurrentUserOrganizer && (
          <TouchableOpacity
            style={styles.editShowButton}
            onPress={navigateToEditShow}
          >
            <Ionicons name="create" size={20} color="#FFFFFF" style={styles.claimButtonIcon} />
            <Text style={styles.claimButtonText}>Edit Show Details</Text>
          </TouchableOpacity>
        )}
        
        {show.organizer_id && show.profiles && (`
  );
}

// 8. Add styles for the claim and edit buttons
if (!content.includes('claimShowButton')) {
  content = content.replace(
    'const styles = StyleSheet.create({',
    `const styles = StyleSheet.create({`
  );
  
  content = content.replace(
    'infoText: {',
    `infoText: {`
  );
  
  content = content.replace(
    'organizerContainer: {',
    `claimShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6A00',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  editShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0057B8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  claimButtonIcon: {
    marginRight: 8,
  },
  claimButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  organizerContainer: {`
  );
}

// Write the modified content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Successfully modified ShowDetailScreen.tsx');
