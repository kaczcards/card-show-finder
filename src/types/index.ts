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
  isEmailVerified: boolean;
  favoriteShows?: string[]; // Array of show IDs
  attendedShows?: string[]; // Array of show IDs for past shows
}

// Authentication types
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
}

export enum ShowStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ACTIVE = 'ACTIVE' // Default in Supabase
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
  showId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  date: Date | string;
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
  dateEarned?: Date | string;
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
