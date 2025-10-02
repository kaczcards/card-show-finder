// Alternative password reset using a different domain
// Use this if the query parameters don't work

export const _resetPasswordAlternative = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://reset.csfinderapp.com/password-reset',
    });
    
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error sending password reset:', error.message);
    throw error;
  }
};