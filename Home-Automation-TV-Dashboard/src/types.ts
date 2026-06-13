/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpotifyQueueItem {
  id: string;
  title: string;
  artist: string;
  duration: string;
  album: string;
}

export interface SpotifyState {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  progressMs: number;
  albumArtUrl: string;
  deviceName: string;
  volumePercent: number;
  queue: SpotifyQueueItem[];
}

export interface MovieItem {
  id: string;
  title: string;
  year: string;
  duration: string;
  rating: string;
  genres: string[];
  posterUrl: string;
  description: string;
}

export interface MovieList {
  category: string;
  items: MovieItem[];
}

export interface TVShowItem {
  id: string;
  title: string;
  season: string;
  episode: string;
  progress: number; // 0-100 percentage
  rating: string;
  posterUrl: string;
  description: string;
}

export interface TVShowList {
  category: string;
  items: TVShowItem[];
}

export interface Tasklist {
  id: string;
  title: string;
  description: string;
  totalTasks: number;
  completedTasks: number;
  icon: string;
  color: string;
}

export interface TaskDetailedItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'Low' | 'Medium' | 'High';
  dueDate: string;
  notes?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  qty: string;
  bought: boolean;
}

export interface GroceryCategory {
  name: string;
  items: GroceryItem[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  category: string;
  description: string;
  color: string;
}

export interface WeatherForecastItem {
  time: string;
  temp: number;
  icon: string;
}

export interface WeatherInfo {
  currentTemp: number;
  feelsLike: number;
  high: number;
  low: number;
  condition: string;
  humidityPercent: number;
  windSpeedMph: number;
  location: string;
  forecast: WeatherForecastItem[];
}

export interface LocalNewsItem {
  id: string;
  source: string;
  headline: string;
  snippet: string;
}

export interface MovieRelease {
  id: string;
  title: string;
  type: 'Movie' | 'TV Show';
  releaseDay: string;
  platform: string;
}

export interface RockyStatus {
  bodyTemp: string;
  chamberPressure: string;
  chamberOxygen: string;
  mood: string;
  activity: string;
}

export interface VocabularyItem {
  concept: string;
  soundNotes: string;
  english: string;
}

export interface RockyConversationItem {
  id: string;
  timestamp: string;
  prompt: string;
  chords: string;
  translation: string;
}

export interface RockyData {
  name: string;
  species: string;
  habitat: string;
  temperament: string;
  status: RockyStatus;
  vocabulary: VocabularyItem[];
  quotes: string[];
  conversations: RockyConversationItem[];
}
