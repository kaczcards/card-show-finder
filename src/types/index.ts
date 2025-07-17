/**
 * Type definitions for the Card Show Finder app
 */

// User-related types
export enum UserRole {
  ATTENDEE = 'attendee',
  DEALER = 'dealer',
  MVP_DEALER = 'mvp_dealer',
  SHOW_ORGANIZER = 'show_organizer'
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  homeZipCode: string;
  role: UserRole;
  createdAt: Date | string;
  updatedAt: Date | string;
  phoneNumber?: string;
  profileImageUrl?: string;
  /**
   * Indicates whether the user's email has been verified.
   */
  isEmailVerified: boolean;
  /**
   * Tier of account the user currently has.
   * - 'collector': free attendee account
   * - 'dealer'   : paid dealer subscription
   * - 'organizer': paid show–organizer subscription
   */
  accountType: 'collector' | 'dealer' | 'organizer';
  /**
   * Current subscription status for dealer / organizer accounts.
   * Collectors will typically have 'none'.
   */
  subscriptionStatus: 'active' | 'expired' | 'none';
  /**
   * Current payment status.  Distinguishes users still
   * in their free-trial window from those who have paid.
   * - 'trial' : user is within the free-trial period
   * - 'paid'  : user has an active paid subscription
   * - 'none'  : user has no trial or paid subscription (collectors or expired)
   */
  paymentStatus: 'trial' | 'paid' | 'none';
  /**
   * Timestamp indicating when the paid subscription expires.
   * Null for free collector accounts or when there is no active subscription.
   */
  subscriptionExpiry: Date | string | null;
  favoriteShows?: string[];   // Array of show IDs
  /**
   * Count of shows the user has favorited.
   * This is maintained automatically by database triggers when using user_favorite_shows table.
   */
  favoriteShowsCount?: number;
  attendedShows?: string[];   // Array of show IDs for past shows
  /**
   * Running counter of shows the user has attended.
   * This is incremented automatically when a user submits a post-show review.
   */
  showAttendanceCount?: number;
  /**
   * Number of pre-show broadcast messages the organizer can still send.
   * Only relevant when role === UserRole.SHOW_ORGANIZER.
   */
  preShowBroadcastsRemaining?: number;
  /**
   * Number of post-show broadcast messages the organizer can still send.
   * Only relevant when role === UserRole.SHOW_ORGANIZER.
   */
  postShowBroadcastsRemaining?: number;
  /**
   * Social media and marketplace profile URLs.
   * Added in Task 8 for Profile and Show Pop-up enhancements.
   */
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  whatnotUrl?: string;
  ebayStoreUrl?: string;
}

/* ------------------------------------------------------------------
 * Authentication helper types
 * ------------------------------------------------------------------ */
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

// Show-related types
export interface Show {
  id: string;
  /**
   * Optional link to the parent Show Series if this is a recurring show.
   * Null/undefined for one-off shows.
   */
  seriesId?: string;
  title: string;
  description?: string;
  location: string; // Venue name/location description
  address: string;
  startDate: Date | string;
  endDate: Date | string;
  startTime?: string; // Optional, not in DB schema
  endTime?: string; // Optional, not in DB schema
  entryFee: number;
  imageUrl?: string;
  rating?: number;
  coordinates?: Coordinates;
  status: ShowStatus;
  organizerId: string;
  features?: Record<string, boolean>; // JSON object in Supabase
  categories?: string[]; // Array in Supabase
  createdAt: Date | string;
  updatedAt: Date | string;
  websiteUrl?: string;
}

export enum ShowStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ACTIVE = 'ACTIVE' // Default in Supabase
}

/* ------------------------------------------------------------------
 * Recurring Show Series
 * ------------------------------------------------------------------ */
export interface ShowSeries {
  id: string;
  /**
   * The official name of the recurring show (e.g., "Noblesville Card Show").
   */
  name: string;
  /**
   * User ID of the organizer who claimed this series (nullable if unclaimed).
   */
  organizerId?: string | null;
  /**
   * General description of the show series.
   */
  description?: string;
  /**
   * Aggregate star rating across all reviews for the series.
   */
  averageRating?: number;
  /**
   * Total number of reviews the series has received.
   */
  reviewCount?: number;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export enum ShowFeature {
  ON_SITE_GRADING = 'On-site Grading',
  AUTOGRAPHS = 'Autograph Guests',
  FOOD_VENDORS = 'Food Vendors',
  DOOR_PRIZES = 'Door Prizes',
  AUCTION = 'Auction',
  BREAKERS = 'Card Breakers'
}

export enum CardCategory {
  SPORTS = 'Sports Cards',
  POKEMON = 'Pokemon',
  MAGIC = 'Magic: The Gathering',
  YU_GI_OH = 'Yu-Gi-Oh',
  COMICS = 'Comics',
  MEMORABILIA = 'Memorabilia',
  VINTAGE = 'Vintage',
  OTHER = 'Other'
}

// Review-related types
export interface Review {
  id: string;
  /**
   * Foreign key to the parent show series being reviewed.
   */
  seriesId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  date: Date | string;
  /**
   * Favorite dealer information captured in the post-show review.
   */
  favoriteDealer?: string;
  favoriteDealerReason?: string;
  organizerResponse?: {
    comment: string;
    date: Date | string;
  };
}

// Filter-related types
export interface ShowFilters {
  radius?: number; // in miles (25, 50, 100, 200)
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  maxEntryFee?: number;
  features?: string[];
  categories?: string[];
  latitude?: number; // For geospatial filtering
  longitude?: number; // For geospatial filtering
  status?: ShowStatus; // For filtering by show status
  /**
   * If true, the cache will be bypassed and a fresh API request will be made
   */
  bypassCache?: boolean;
}

// Collection-related types
export interface CollectionItem {
  id: string;
  userId: string;
  name: string;
  description?: string;
  imageUrl: string;
  category: string;
  isForSale: boolean;
  isWanted: boolean;
  createdAt: Date | string;
}

// Message-related types
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date | string;
  isRead: boolean;
  showId?: string; // Optional reference to a show
}

// Badge/Reward types
export interface Badge {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  requirement: string;
  /**
   * Tier of the badge (e.g., bronze, silver, gold, platinum).
   */
  tier: BadgeTier;
  dateEarned?: Date | string;
}

export enum BadgeTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

// My Collection – Card images
export interface UserCard {
  id: string;
  userId: string;
  imageUrl: string;
  title?: string;
  description?: string;
  category?: string;
  /**
   * Indicates whether the uploaded image has been compressed
   * before being stored in Supabase Storage.
   */
  isCompressed?: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// My Collection – Want list
export interface WantList {
  id: string;
  userId: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Notifications (e.g., review requests, badge earned)
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  /**
   * notification type, e.g., 'review_request', 'badge_earned'
   */
  type: string;
  referenceId?: string; // Show ID, Badge ID, etc.
  isRead: boolean;
  createdAt: Date | string;
}

// Tracking planned attendance
export interface PlannedAttendance {
  id: string;
  showId: string;
  userId: string;
  createdAt: Date | string;
}

// Utility types
export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type ZipCodeData = {
  zipCode: string;
  city: string;
  state: string;
  coordinates: Coordinates;
};
