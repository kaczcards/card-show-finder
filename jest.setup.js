// jest.setup.js - Jest global setup file for Card Show Finder app
import { NativeModules } from 'react-native';
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import 'react-native-gesture-handler/jestSetup';
import { createClient } from '@supabase/supabase-js';

// ======================================================
// 1. React Native Mocks
// ======================================================
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock react-native modules that aren't needed in tests
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  // Mock native modules that cause issues in Jest
  RN.NativeModules.StatusBarManager = { getHeight: jest.fn() };
  RN.NativeModules.ImagePickerManager = { getBase64Image: jest.fn() };
  RN.Dimensions.get = jest.fn().mockReturnValue({
    width: 375,
    height: 812,
    scale: 2,
    fontScale: 1
  });
  
  // Add other RN mocks as needed
  RN.Alert = { alert: jest.fn() };
  RN.Platform = { ...RN.Platform, OS: 'ios', select: jest.fn(obj => obj.ios) };
  RN.Linking = { ...RN.Linking, openURL: jest.fn() };
  
  return RN;
});

// ======================================================
// 2. Expo Module Mocks
// ======================================================
// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      altitude: 0,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 0
    },
    timestamp: 1625097600000
  }),
  geocodeAsync: jest.fn().mockResolvedValue([{
    latitude: 37.7749,
    longitude: -122.4194,
    altitude: 0,
    accuracy: 5
  }]),
  reverseGeocodeAsync: jest.fn().mockResolvedValue([{
    city: 'San Francisco',
    country: 'United States',
    district: 'Downtown',
    isoCountryCode: 'US',
    name: '123 Main St',
    postalCode: '94105',
    region: 'CA',
    street: 'Main St',
    streetNumber: '123',
    timezone: 'America/Los_Angeles'
  }])
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
  dismissNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() })
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  brand: 'Apple',
  manufacturer: 'Apple',
  modelName: 'iPhone 12',
  deviceName: 'iPhone',
  deviceYearClass: 2020,
  totalMemory: 4000000000,
  supportedCpuArchitectures: ['arm64'],
  osName: 'iOS',
  osVersion: '14.5',
  osBuildId: '18F72',
  osInternalBuildId: '18F72',
  osBuildFingerprint: 'Apple/iPhone/iPhone:14.5/18F72/123456:user/release-keys',
  platformApiLevel: 30,
  deviceType: 1
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn()
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    cancelled: false,
    assets: [{
      uri: 'file://test-image.jpg',
      width: 100,
      height: 100,
      type: 'image',
      fileName: 'test-image.jpg',
      fileSize: 1000
    }]
  }),
  launchCameraAsync: jest.fn().mockResolvedValue({
    cancelled: false,
    assets: [{
      uri: 'file://test-camera-image.jpg',
      width: 100,
      height: 100,
      type: 'image',
      fileName: 'test-camera-image.jpg',
      fileSize: 1000
    }]
  })
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: jest.fn().mockReturnValue(null),
  setStatusBarStyle: jest.fn(),
  setStatusBarHidden: jest.fn(),
  setStatusBarTranslucent: jest.fn(),
  setStatusBarBackgroundColor: jest.fn()
}));

// ======================================================
// 3. Global Test Utilities and Helpers
// ======================================================
// Add global test utilities
global.waitFor = async (callback, { timeout = 5000, interval = 100 } = {}) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await callback();
      return result;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error(`Timed out after ${timeout}ms`);
};

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  }
});

// Helper to simulate press events
global.fireEvent = {
  press: element => {
    element.props.onPress && element.props.onPress();
  },
  changeText: (element, text) => {
    element.props.onChangeText && element.props.onChangeText(text);
  }
};

// ======================================================
// 4. Supabase Mocks
// ======================================================
// Mock Supabase client
const mockSupabaseFrom = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  containedBy: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  overlaps: jest.fn().mockReturnThis(),
  textSearch: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  and: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  match: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  csv: jest.fn().mockReturnThis(),
  then: jest.fn().mockImplementation(callback => Promise.resolve(callback({ data: [], error: null }))),
  data: null,
  error: null
});

const mockSupabaseRpc = jest.fn().mockReturnValue({
  data: null,
  error: null,
  then: jest.fn().mockImplementation(callback => Promise.resolve(callback({ data: [], error: null })))
});

const mockSupabaseStorage = {
  from: jest.fn().mockReturnValue({
    upload: jest.fn().mockResolvedValue({ data: { path: 'test-file.jpg' }, error: null }),
    download: jest.fn().mockResolvedValue({ data: new Blob(['test']), error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test-file.jpg' }, error: null }),
    list: jest.fn().mockResolvedValue({ data: [{ name: 'test-file.jpg' }], error: null }),
    remove: jest.fn().mockResolvedValue({ data: { path: 'test-file.jpg' }, error: null })
  })
};

const mockSupabaseAuth = {
  signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
  signIn: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  session: { user: { id: 'test-user-id', email: 'test@example.com' } },
  user: { id: 'test-user-id', email: 'test@example.com' },
  onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } }, error: null })
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
    storage: mockSupabaseStorage,
    auth: mockSupabaseAuth
  }))
}));

// Create a test supabase client that can be imported in tests
global.testSupabase = createClient('https://test.supabase.co', 'test-key');

// ======================================================
// 5. Navigation Library Mocks
// ======================================================
// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      dispatch: jest.fn(),
      reset: jest.fn(),
      isFocused: jest.fn().mockReturnValue(true),
      addListener: jest.fn().mockReturnValue(jest.fn())
    }),
    useRoute: () => ({
      params: {},
      name: 'TestScreen',
      key: 'test-key'
    }),
    useFocusEffect: jest.fn(),
    useIsFocused: jest.fn().mockReturnValue(true)
  };
});

jest.mock('@react-navigation/stack', () => {
  const actualNav = jest.requireActual('@react-navigation/stack');
  return {
    ...actualNav,
    createStackNavigator: jest.fn().mockReturnValue({
      Navigator: 'MockNavigator',
      Screen: 'MockScreen'
    })
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const actualNav = jest.requireActual('@react-navigation/bottom-tabs');
  return {
    ...actualNav,
    createBottomTabNavigator: jest.fn().mockReturnValue({
      Navigator: 'MockTabNavigator',
      Screen: 'MockTabScreen'
    })
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const actualNav = jest.requireActual('@react-navigation/native-stack');
  return {
    ...actualNav,
    createNativeStackNavigator: jest.fn().mockReturnValue({
      Navigator: 'MockNativeStackNavigator',
      Screen: 'MockNativeStackScreen'
    })
  };
});

// ======================================================
// 6. Console Log Suppression
// ======================================================
// Suppress console logs during tests for cleaner output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Comment out these lines to see console output during tests
console.log = jest.fn();
console.error = jest.fn();
console.warn = jest.fn();
console.info = jest.fn();

// Restore console functions after tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
});

// ======================================================
// 7. Fake Timers Configuration
// ======================================================
// Use fake timers
jest.useFakeTimers();

// Configure to use modern timers
jest.setSystemTime(new Date('2025-07-22T12:00:00Z').getTime());

// ======================================================
// 8. Global Test Environment Variables
// ======================================================
// Set up test environment variables
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-google-maps-key';
process.env.EXPO_PUBLIC_APP_ENV = 'test';

// Add test-specific global variables
global.TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User'
};

global.TEST_SHOW = {
  id: 'test-show-id',
  name: 'Test Card Show',
  description: 'A test card show for unit tests',
  location: 'Test Convention Center',
  address: '123 Test St, Test City, TS 12345',
  start_date: '2025-08-15',
  end_date: '2025-08-16',
  coordinates: {
    latitude: 37.7749,
    longitude: -122.4194
  }
};

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(props => React.createElement('MockMapView', props, props.children)),
    Marker: jest.fn().mockImplementation(props => React.createElement('MockMarker', props, props.children)),
    Callout: jest.fn().mockImplementation(props => React.createElement('MockCallout', props, props.children)),
    Circle: jest.fn().mockImplementation(props => React.createElement('MockCircle', props, props.children)),
    PROVIDER_GOOGLE: 'google'
  };
});

// Mock react-native-maps-super-cluster
jest.mock('react-native-maps-super-cluster', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(props => React.createElement('MockClusteredMapView', props, props.children))
  };
});

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
  hide: jest.fn(),
  setRef: jest.fn()
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => {
  const actualModule = jest.requireActual('@tanstack/react-query');
  return {
    ...actualModule,
    useQuery: jest.fn().mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn()
    }),
    useMutation: jest.fn().mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
      isError: false,
      error: null,
      reset: jest.fn()
    }),
    useInfiniteQuery: jest.fn().mockReturnValue({
      data: { pages: [], pageParams: [] },
      isLoading: false,
      isError: false,
      error: null,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false
    })
  };
});
