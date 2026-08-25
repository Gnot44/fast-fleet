import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_BANGKOK_LOCATION } from './mapServices';

export interface StopItem {
  id: string;
  name: string;
  address: string;
  recipient?: string;
  phone?: string;
  items?: string;
  latitude?: number;
  longitude?: number;
  appointmentId?: string;
  isConfirmed?: boolean;
}

export interface TripDraftState {
  tripName: string;
  odometer: string;
  startLocation: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  };
  isStartSubmitted: boolean;
  tabMode: 'startNow' | 'planLater';
  selectedDate: string; // ISO String
  selectedTimeSlot: string;
  stops: StopItem[];
  editingTripId: string | null;
}

const defaultDraft: TripDraftState = {
  tripName: '',
  odometer: '',
  startLocation: {
    latitude: DEFAULT_BANGKOK_LOCATION.latitude,
    longitude: DEFAULT_BANGKOK_LOCATION.longitude,
    name: DEFAULT_BANGKOK_LOCATION.name,
    address: DEFAULT_BANGKOK_LOCATION.address,
  },
  isStartSubmitted: false,
  tabMode: 'startNow',
  selectedDate: new Date().toISOString(),
  selectedTimeSlot: '08:30 AM',
  stops: [],
  editingTripId: null,
};

interface TripDraftContextType {
  draft: TripDraftState;
  setTripName: (name: string) => void;
  setOdometer: (odo: string) => void;
  setStartLocation: (loc: { latitude: number; longitude: number; name: string; address: string }) => void;
  setIsStartSubmitted: (submitted: boolean) => void;
  setTabMode: (mode: 'startNow' | 'planLater') => void;
  setSelectedDate: (date: Date) => void;
  setSelectedTimeSlot: (slot: string) => void;
  addStop: (stop: StopItem) => void;
  updateStop: (index: number, stop: Partial<StopItem>) => void;
  removeStop: (id: string) => void;
  setStops: (stops: StopItem[]) => void;
  reorderStops: (stops: StopItem[]) => void;
  resetDraft: () => Promise<void>;
  loadExistingTripDraft: (tripId: string, tripData: any) => void;
  isLoaded: boolean;
  
  // Active Trip Drops Management (For ActiveTracker & EditTripItinerary)
  activeTripDrops: StopItem[];
  setActiveTripDrops: (drops: StopItem[]) => void;
  addActiveTripDrop: (drop: StopItem) => void;
  updateActiveTripDrop: (index: number, dropUpdates: Partial<StopItem>) => void;
  removeActiveTripDrop: (id: string) => void;
}

const TripDraftContext = createContext<TripDraftContextType | undefined>(undefined);

const DRAFT_STORAGE_KEY = '@trip_draft_v2';

export function TripDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<TripDraftState>(defaultDraft);
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialMount = useRef(true);

  // 1. Load draft from AsyncStorage on initial boot
  useEffect(() => {
    async function loadSavedDraft() {
      try {
        const saved = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            setDraftState((prev) => ({
              ...prev,
              ...parsed,
              stops: Array.isArray(parsed.stops) ? parsed.stops : [],
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to load trip draft from AsyncStorage:', err);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSavedDraft();
  }, []);

  // 2. Auto-save draft changes to AsyncStorage (debounced)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!isLoaded) return;

    const timeout = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } catch (err) {
        console.warn('Failed to save trip draft to AsyncStorage:', err);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [draft, isLoaded]);

  const setTripName = (tripName: string) => {
    setDraftState((prev) => ({ ...prev, tripName }));
  };

  const setOdometer = (odometer: string) => {
    setDraftState((prev) => ({ ...prev, odometer }));
  };

  const setStartLocation = (startLocation: { latitude: number; longitude: number; name: string; address: string }) => {
    setDraftState((prev) => ({ ...prev, startLocation }));
  };

  const setIsStartSubmitted = (isStartSubmitted: boolean) => {
    setDraftState((prev) => ({ ...prev, isStartSubmitted }));
  };

  const setTabMode = (tabMode: 'startNow' | 'planLater') => {
    setDraftState((prev) => ({ ...prev, tabMode }));
  };

  const setSelectedDate = (date: Date) => {
    setDraftState((prev) => ({ ...prev, selectedDate: date.toISOString() }));
  };

  const setSelectedTimeSlot = (selectedTimeSlot: string) => {
    setDraftState((prev) => ({ ...prev, selectedTimeSlot }));
  };

  const addStop = (stop: StopItem) => {
    setDraftState((prev) => ({
      ...prev,
      stops: [...prev.stops, stop],
    }));
  };

  const updateStop = (index: number, stopUpdates: Partial<StopItem>) => {
    setDraftState((prev) => ({
      ...prev,
      stops: prev.stops.map((s, i) => (i === index ? { ...s, ...stopUpdates } : s)),
    }));
  };

  const removeStop = (id: string) => {
    setDraftState((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.id !== id),
    }));
  };

  const setStops = (stops: StopItem[]) => {
    setDraftState((prev) => ({ ...prev, stops }));
  };

  const reorderStops = (stops: StopItem[]) => {
    setDraftState((prev) => ({ ...prev, stops }));
  };

  const resetDraft = async () => {
    setDraftState(defaultDraft);
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (e) {}
  };

  const loadExistingTripDraft = (tripId: string, tripData: any) => {
    const startLoc = tripData.start_location || {};
    const loadedStops: StopItem[] = Array.isArray(tripData.appointments)
      ? [...tripData.appointments]
          .sort((a: any, b: any) => (a.sequence_order || 0) - (b.sequence_order || 0))
          .map((a: any) => ({
            id: a.id,
            appointmentId: a.id,
            name: a.company_name,
            recipient: a.recipient_name || a.customer_name || '',
            phone: a.recipient_phone || '',
            items: a.agenda || '',
            address: a.destination_address || '',
            latitude: a.destination_lat || undefined,
            longitude: a.destination_lng || undefined,
            isConfirmed: !!a.confirmation_status,
          }))
      : [];

    setDraftState({
      tripName: tripData.title || '',
      odometer: tripData.start_odometer ? tripData.start_odometer.toString() : '',
      startLocation: {
        latitude: startLoc.latitude || DEFAULT_BANGKOK_LOCATION.latitude,
        longitude: startLoc.longitude || DEFAULT_BANGKOK_LOCATION.longitude,
        name: startLoc.name || DEFAULT_BANGKOK_LOCATION.name,
        address: startLoc.address || DEFAULT_BANGKOK_LOCATION.address,
      },
      isStartSubmitted: !!(startLoc.latitude && startLoc.longitude),
      tabMode: tripData.status === 'scheduled' ? 'planLater' : 'startNow',
      selectedDate: tripData.trip_date ? new Date(tripData.trip_date).toISOString() : new Date().toISOString(),
      selectedTimeSlot: '08:30 AM',
      stops: loadedStops,
      editingTripId: tripId,
    });
  };

  // Active Trip Drops Management
  const [activeTripDrops, setActiveTripDrops] = useState<StopItem[]>([]);

  const addActiveTripDrop = (drop: StopItem) => {
    setActiveTripDrops((prev) => [...prev, drop]);
  };

  const updateActiveTripDrop = (index: number, dropUpdates: Partial<StopItem>) => {
    setActiveTripDrops((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...dropUpdates } : s))
    );
  };

  const removeActiveTripDrop = (id: string) => {
    setActiveTripDrops((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <TripDraftContext.Provider
      value={{
        draft,
        setTripName,
        setOdometer,
        setStartLocation,
        setIsStartSubmitted,
        setTabMode,
        setSelectedDate,
        setSelectedTimeSlot,
        addStop,
        updateStop,
        removeStop,
        setStops,
        reorderStops,
        resetDraft,
        loadExistingTripDraft,
        isLoaded,
        activeTripDrops,
        setActiveTripDrops,
        addActiveTripDrop,
        updateActiveTripDrop,
        removeActiveTripDrop,
      }}
    >
      {children}
    </TripDraftContext.Provider>
  );
}

export function useTripDraft() {
  const context = useContext(TripDraftContext);
  if (!context) {
    throw new Error('useTripDraft must be used within a TripDraftProvider');
  }
  return context;
}
