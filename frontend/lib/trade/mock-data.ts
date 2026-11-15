// Demo fixtures for front-end development until the Landing, Profile and trade APIs exist.
import type { TradeItem, TradeUser } from './types';

export const DEMO_USERS: TradeUser[] = [
  { id: 'u-sam', displayName: 'Sam Park', location: 'Tempe, AZ' },
  { id: 'u-jordan', displayName: 'Jordan Lee', location: 'Mesa, AZ' },
  { id: 'u-riley', displayName: 'Riley Chen', location: 'Phoenix, AZ' },
];

export const DEFAULT_DEMO_USER_ID = 'u-sam';

export const DEMO_ITEMS: TradeItem[] = [
  { id: 'i-sam-1', ownerId: 'u-sam', title: 'Polaroid OneStep camera', category: 'Cameras', condition: 'good', estimatedValue: 65, status: 'available' },
  { id: 'i-sam-2', ownerId: 'u-sam', title: 'Brass desk lamp', category: 'Home', condition: 'fair', estimatedValue: 30, status: 'available' },
  { id: 'i-sam-3', ownerId: 'u-sam', title: 'Vinyl records, 12-pack (70s rock)', category: 'Music', condition: 'good', estimatedValue: 80, status: 'available' },
  { id: 'i-sam-4', ownerId: 'u-sam', title: 'Cast-iron skillet, 10"', category: 'Kitchen', condition: 'like-new', estimatedValue: 25, status: 'available' },
  { id: 'i-sam-5', ownerId: 'u-sam', title: 'Road bike helmet (M)', category: 'Sports', condition: 'worn', estimatedValue: 15, status: 'available' },
  { id: 'i-jordan-1', ownerId: 'u-jordan', title: 'Canon 50mm f/1.8 lens', category: 'Cameras', condition: 'like-new', estimatedValue: 90, status: 'available' },
  { id: 'i-jordan-2', ownerId: 'u-jordan', title: 'Mechanical keyboard (brown switches)', category: 'Electronics', condition: 'good', estimatedValue: 55, status: 'available' },
  { id: 'i-jordan-3', ownerId: 'u-jordan', title: 'Mid-century side table', category: 'Furniture', condition: 'fair', estimatedValue: 70, status: 'available' },
  { id: 'i-jordan-4', ownerId: 'u-jordan', title: 'Board game bundle (3 games)', category: 'Games', condition: 'good', estimatedValue: 40, status: 'available' },
  { id: 'i-jordan-5', ownerId: 'u-jordan', title: 'Acoustic guitar strap', category: 'Music', condition: 'new', estimatedValue: 12, status: 'available' },
  { id: 'i-jordan-6', ownerId: 'u-jordan', title: 'Film scanner', category: 'Electronics', condition: 'good', estimatedValue: 60, status: 'removed' },
];
