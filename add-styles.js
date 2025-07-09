const fs = require('fs');
const path = require('path');

// Path to the ShowDetailScreen.tsx file
const filePath = path.join(__dirname, 'src', 'screens', 'ShowDetail', 'ShowDetailScreen.tsx');

// Read the current content of the file
let content = fs.readFileSync(filePath, 'utf8');

// Add the missing styles
if (!content.includes('claimShowButton:')) {
  // Find the styles section
  const stylesIndex = content.indexOf('const styles = StyleSheet.create({');
  if (stylesIndex !== -1) {
    // Find a place to insert our new styles
    const organizerContainerIndex = content.indexOf('organizerContainer: {', stylesIndex);
    if (organizerContainerIndex !== -1) {
      // Add our styles before organizerContainer
      const newStyles = `claimShowButton: {
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
  `;
      
      // Insert the new styles
      content = content.slice(0, organizerContainerIndex) + newStyles + content.slice(organizerContainerIndex);
      
      // Fix the erroneous backtick in the error message
      content = content.replace("<Text style={styles.errorText}>{error || 'Show not found'}`}</Text>", "<Text style={styles.errorText}>{error || 'Show not found'}</Text>");
      
      // Also fix the fetchShowDetails function to set the organizer flags
      const setShowDataIndex = content.indexOf('setShow(data);');
      if (setShowDataIndex !== -1) {
        const additionalCode = `
        // Determine if the current user is the organizer of this show
        setIsCurrentUserOrganizer(user?.id === data.organizer_id);
        
        // Determine if the show can be claimed (no organizer assigned)
        setCanClaimShow(isShowOrganizer && !data.organizer_id);`;
        
        // Insert after setShow(data);
        if (!content.includes('setIsCurrentUserOrganizer')) {
          content = content.slice(0, setShowDataIndex + 'setShow(data);'.length) + additionalCode + content.slice(setShowDataIndex + 'setShow(data);'.length);
        }
      }
      
      // Write the modified content back to the file
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Successfully added missing styles to ShowDetailScreen.tsx');
    } else {
      console.error('Could not find organizerContainer in styles');
    }
  } else {
    console.error('Could not find styles section');
  }
} else {
  console.log('Styles already exist, no changes needed');
}
