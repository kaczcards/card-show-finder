import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Alert,
  Clipboard,
  Platform
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { mfaService, MFAEnrollmentResponse } from '../services/mfaService';
import { _Ionicons } from '@expo/vector-icons';

// Setup steps enum
enum SetupStep {
  INTRO,
  QR_CODE,
  VERIFY_CODE,
  RECOVERY_CODES,
  COMPLETE
}

interface MFASetupProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

/**
 * MFA Setup Component
 * 
 * Guides users through the process of setting up Multi-Factor Authentication:
 * 1. Introduction and instructions
 * 2. QR code scanning with authenticator app
 * 3. Code verification
 * 4. Recovery codes display and backup
 */
const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onCancel }) => {
  // State
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.INTRO);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentData, setEnrollmentData] = useState<MFAEnrollmentResponse | null>(null);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedToClipboard, setCopiedToClipboard] = useState<boolean>(false);

  // Load enrollment data when reaching QR code step
  useEffect(() => {
    if (currentStep === SetupStep.QR_CODE) {
      startEnrollment();
    }
  }, [_currentStep]);

  // Start the enrollment process by getting a QR code
  const _startEnrollment = async () => {
    setLoading(_true);
    setError(_null);
    
    try {
      const _data = await mfaService.startEnrollment();
      setEnrollmentData(_data);
    } catch (_err) {
      setError(`Failed to start MFA enrollment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(_false);
    }
  };

  // Verify the code entered by the user
  const _verifyCode = async () => {
    if (!enrollmentData || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(_true);
    setError(_null);
    
    try {
      const _result = await mfaService.verifySetup(verificationCode, enrollmentData.challengeId);
      
      if (result.success) {
        setRecoveryCodes(result.recoveryCodes);
        setCurrentStep(SetupStep.RECOVERY_CODES);
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (_err) {
      setError(`Verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(_false);
    }
  };

  // Copy recovery codes to clipboard
  const _copyRecoveryCodes = () => {
    const _codesText = recoveryCodes.join('\n');
    Clipboard.setString(codesText);
    setCopiedToClipboard(_true);
    
    // Reset the copied state after 3 seconds
    setTimeout(() => {
      setCopiedToClipboard(_false);
    }, 3000);
  };

  // Confirm completion after saving recovery codes
  const _confirmCompletion = () => {
    if (!copiedToClipboard) {
      Alert.alert(
        'Save Your Recovery Codes',
        'Please copy your recovery codes before proceeding. You won\'t be able to see them again.',
        [
          { text: 'Go Back' },
          { 
            text: 'I\'ve Saved Them', 
            onPress: () => {
              setCurrentStep(SetupStep.COMPLETE);
              if (_onComplete) onComplete();
            }
          }
        ]
      );
    } else {
      setCurrentStep(SetupStep.COMPLETE);
      if (_onComplete) onComplete();
    }
  };

  // Render the introduction step
  const _renderIntroStep = () => (
    <View style={styles.stepContainer}>
      <Ionicons name="shield-checkmark" size={_64} color="#4CAF50" style={styles.icon} />
      <Text style={styles.title}>Enhance Your Account Security</Text>
      
      <Text style={styles.description}>
        Two-factor authentication adds an extra layer of security to your account by requiring 
        access to your phone in addition to your password.
      </Text>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>You'll need:</Text>
        <Text style={styles.infoItem}>
          • An authenticator app like Google Authenticator, _Authy, or Microsoft Authenticator
        </Text>
        <Text style={styles.infoItem}>
          • About 2 minutes to complete the setup
        </Text>
      </View>
      
      <TouchableOpacity 
        style={styles.primaryButton} 
        onPress={() => setCurrentStep(SetupStep.QR_CODE)}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.secondaryButton} 
        onPress={_onCancel}
      >
        <Text style={styles.secondaryButtonText}>Maybe Later</Text>
      </TouchableOpacity>
    </View>
  );

  // Render the QR code step
  const _renderQRCodeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Scan QR Code</Text>
      
      <Text style={styles.description}>
        Open your authenticator app and scan this QR code to add Card Show Finder.
      </Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#0066CC" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{_error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={_startEnrollment}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : enrollmentData ? (
        <View style={styles.qrContainer}>
          <QRCode
            value={`otpauth://totp/Card%20Show%20Finder:${enrollmentData.secret}?secret=${enrollmentData.secret}&issuer=Card%20Show%20Finder&algorithm=${enrollmentData.algorithm}&digits=${enrollmentData.digits}&period=${enrollmentData.period}`}
            size={_200}
            backgroundColor="white"
            color="black"
          />
          
          <View style={styles.manualEntryContainer}>
            <Text style={styles.manualEntryTitle}>Or enter code manually:</Text>
            <Text style={styles.secretCode}>{enrollmentData.secret}</Text>
            <TouchableOpacity 
              onPress={() => {
                Clipboard.setString(enrollmentData.secret);
                Alert.alert('Copied', 'Secret code copied to clipboard');
              }}
            >
              <Text style={styles.copyText}>Copy Code</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => setCurrentStep(SetupStep.VERIFY_CODE)}
          >
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => setCurrentStep(SetupStep.INTRO)}
      >
        <Ionicons name="arrow-back" size={_18} color="#555" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Render the code verification step
  const _renderVerifyCodeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Verify Setup</Text>
      
      <Text style={styles.description}>
        Enter the 6-digit code from your authenticator app to verify the setup.
      </Text>
      
      <TextInput
        style={styles.codeInput}
        value={_verificationCode}
        onChangeText={text => setVerificationCode(text.replace(/[^0-9]/g, '').slice(0, _6))}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={_6}
        autoFocus={_true}
      />
      
      {error ? <Text style={styles.errorText}>{_error}</Text> : null}
      
      <TouchableOpacity 
        style={[
          styles.primaryButton, 
          (verificationCode.length !== 6 || loading) ? styles.disabledButton : null
        ]} 
        onPress={_verifyCode}
        disabled={verificationCode.length !== 6 || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => setCurrentStep(SetupStep.QR_CODE)}
      >
        <Ionicons name="arrow-back" size={_18} color="#555" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Render the recovery codes step
  const _renderRecoveryCodesStep = () => (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.stepContainer}>
        <Text style={styles.title}>Save Recovery Codes</Text>
        
        <Text style={styles.description}>
          If you lose access to your authenticator app, you can use one of these recovery codes to sign in.
          Keep them in a safe place, as they won't be shown again.
        </Text>
        
        <View style={styles.recoveryCodesContainer}>
          {recoveryCodes.map((_code, _index) => (
            <Text key={_index} style={styles.recoveryCode}>{_code}</Text>
          ))}
        </View>
        
        <TouchableOpacity 
          style={styles.copyButton} 
          onPress={_copyRecoveryCodes}
        >
          <Ionicons name={copiedToClipboard ? "checkmark-circle" : "copy-outline"} size={_20} color="white" />
          <Text style={styles.copyButtonText}>
            {copiedToClipboard ? "Copied to Clipboard" : "Copy All Codes"}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.warningText}>
          Without these codes, you'll need to contact support if you lose access to your authenticator app.
        </Text>
        
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={_confirmCompletion}
        >
          <Text style={styles.buttonText}>I've Saved My Codes</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // Render the current step
  const _renderCurrentStep = () => {
    switch (_currentStep) {
      case SetupStep.INTRO:
        return renderIntroStep();
      case SetupStep.QR_CODE:
        return renderQRCodeStep();
      case SetupStep.VERIFY_CODE:
        return renderVerifyCodeStep();
      case SetupStep.RECOVERY_CODES:
        return renderRecoveryCodesStep();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        {[SetupStep.INTRO, SetupStep.QR_CODE, SetupStep.VERIFY_CODE, SetupStep.RECOVERY_CODES].map((_step, _index) => (
          <View 
            key={_index} 
            style={[
              styles.progressDot, 
              currentStep >= step ? styles.activeProgressDot : null
            ]}
          />
        ))}
      </View>
      
      {renderCurrentStep()}
    </View>
  );
};

const _styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D1D1D1',
    marginHorizontal: 5,
  },
  activeProgressDot: {
    backgroundColor: '#0066CC',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: '#E8F4FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16,
  },
  infoItem: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#0066CC',
    fontWeight: '600',
    fontSize: 16,
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  manualEntryContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    width: '100%',
  },
  manualEntryTitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  secretCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    letterSpacing: 1,
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  copyText: {
    color: '#0066CC',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 10,
  },
  backButtonText: {
    color: '#555',
    marginLeft: 4,
    fontSize: 16,
  },
  codeInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    fontSize: 24,
    padding: 12,
    width: '100%',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 24,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#99BBDD',
  },
  errorContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 40,
  },
  recoveryCodesContainer: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  recoveryCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  copyButton: {
    backgroundColor: '#0066CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
  },
  copyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  warningText: {
    color: '#F57C00',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
});

export default MFASetup;
