import type { AIProvider } from 'aura-ai-chat';

export type ChatProviderRequest = Parameters<AIProvider['sendMessages']>[0];
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface GreenStepsChatRequest {
  message: string;
  sessionId: string;
  history: ChatHistoryMessage[];
  plannerState?: ChatItineraryDraft | null;
  currentTours?: ChatTour[];
}
export interface GreenStepsChatResponse {
  success: boolean;
  reply: string;
  sessionId: string;
  type?: 'text' | 'tour_recommendations' | 'itinerary_proposal' | 'tour_recommendation' | 'itinerary' | 'clarification';
  tours?: ChatTour[];
  totalTours?: number;
  hasMoreTours?: boolean;
  catalogAvailable?: boolean;
  itinerary?: ChatItineraryDraft | null;
  suggestedQuestions?: string[];
}

export interface ChatTour {
  id: string;
  name: string;
  destination: string;
  durationDays: number | null;
  durationNights: number | null;
  price: number | null;
  currency: 'VND' | null;
  imageUrl: string | null;
  highlights: string[];
  ecoLabels: string[];
  bookingAvailable: boolean;
  rating?: number | null;
}

export interface ChatActivity {
  name: string;
  time: string;
  cost: number;
  carbon: number;
  type: 'lodging' | 'dining' | 'transport' | 'attraction';
  verified: boolean;
  serviceId: string | null;
}

export interface ChatItineraryDraft {
  name: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  days: ChatActivity[][];
  estimatedCost: number;
  assumptions: string[];
}

export interface GreenStepsChatResult {
  reply: string;
  type: 'text' | 'tour_recommendations' | 'itinerary_proposal' | 'clarification';
  tours: ChatTour[];
  totalTours: number;
  hasMoreTours: boolean;
  catalogAvailable: boolean;
  itinerary: ChatItineraryDraft | null;
  suggestedQuestions: string[];
}

export interface ChatTranscriptMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: GreenStepsChatResult;
  createdAt: number;
}
