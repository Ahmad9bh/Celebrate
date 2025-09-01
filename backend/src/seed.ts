export type Currency = 'GBP' | 'AED' | 'SAR' | 'QAR';
export type Amenity = 'Parking' | 'Catering' | 'AV' | 'Outdoor' | 'Accessible' | 'WiFi';
export type EventType = 'Wedding' | 'Birthday' | 'Graduation' | 'Corporate' | 'Other';

export interface User { id: string; role: 'user' | 'owner' | 'admin'; name: string; email: string; }
export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  amenities: Amenity[];
  eventTypes: EventType[];
  images: string[];
  description: string;
  basePrice: number; // per day in default currency (GBP)
  ownerId: string;
  rating: number;
}
export interface Booking {
  id: string;
  userId: string;
  venueId: string;
  date: string; // ISO date
  guests: number;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled';
  totalPriceGBP: number;
}

export const users: User[] = [
  { id: 'u1', role: 'user', name: 'Alice', email: 'alice@example.com' },
  { id: 'o1', role: 'owner', name: 'Venue Owner', email: 'owner@example.com' },
  { id: 'a1', role: 'admin', name: 'Admin', email: 'admin@example.com' }
];

export const venues: Venue[] = [
  {
    id: 'v1',
    name: 'Grand Hall London',
    city: 'London',
    country: 'UK',
    capacity: 300,
    amenities: ['Parking', 'Catering', 'AV', 'Accessible', 'WiFi'],
    eventTypes: ['Wedding', 'Corporate', 'Birthday'],
    images: ['/images/venue1.jpg'],
    description: 'Iconic hall in central London with modern amenities.',
    basePrice: 5000,
    ownerId: 'o1',
    rating: 4.7
  },
  {
    id: 'v2',
    name: 'Dubai Marina Terrace',
    city: 'Dubai',
    country: 'UAE',
    capacity: 200,
    amenities: ['Outdoor', 'Catering', 'AV', 'WiFi'],
    eventTypes: ['Wedding', 'Corporate', 'Other'],
    images: ['/images/venue2.jpg'],
    description: 'Scenic terrace overlooking Dubai Marina, perfect for celebrations.',
    basePrice: 7000,
    ownerId: 'o1',
    rating: 4.6
  }
];

export const bookings: Booking[] = [
  { id: 'b1', userId: 'u1', venueId: 'v1', date: '2025-09-20', guests: 120, status: 'confirmed', totalPriceGBP: 5200 }
];
