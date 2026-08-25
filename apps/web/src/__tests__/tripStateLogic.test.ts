import { describe, it, expect } from 'vitest';

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

export class TripStateManager {
  private stops: StopItem[] = [];

  constructor(initialStops: StopItem[] = []) {
    this.stops = [...initialStops];
  }

  getStops(): StopItem[] {
    return [...this.stops];
  }

  setStops(stops: StopItem[]): void {
    this.stops = [...stops];
  }

  addStop(stop: StopItem): void {
    this.stops = [...this.stops, stop];
  }

  updateStop(index: number, updates: Partial<StopItem>): void {
    this.stops = this.stops.map((s, i) => (i === index ? { ...s, ...updates } : s));
  }

  removeStop(id: string): { success: boolean; error?: string } {
    const item = this.stops.find((s) => s.id === id);
    if (item?.isConfirmed) {
      return { success: false, error: 'Cannot remove a confirmed/visited stop' };
    }
    this.stops = this.stops.filter((s) => s.id !== id);
    return { success: true };
  }

  moveUp(index: number): { success: boolean; error?: string } {
    if (index <= 0) return { success: false, error: 'Already at top' };
    const prevItem = this.stops[index - 1];
    const currentItem = this.stops[index];
    if (prevItem?.isConfirmed || currentItem?.isConfirmed) {
      return { success: false, error: 'Cannot reorder visited stop' };
    }
    const newStops = [...this.stops];
    const temp = newStops[index];
    newStops[index] = newStops[index - 1];
    newStops[index - 1] = temp;
    this.stops = newStops;
    return { success: true };
  }

  moveDown(index: number): { success: boolean; error?: string } {
    if (index >= this.stops.length - 1) return { success: false, error: 'Already at bottom' };
    const nextItem = this.stops[index + 1];
    const currentItem = this.stops[index];
    if (nextItem?.isConfirmed || currentItem?.isConfirmed) {
      return { success: false, error: 'Cannot reorder visited stop' };
    }
    const newStops = [...this.stops];
    const temp = newStops[index];
    newStops[index] = newStops[index + 1];
    newStops[index + 1] = temp;
    this.stops = newStops;
    return { success: true };
  }
}

describe('Trip & Itinerary State Management Tests', () => {
  it('TC-STATE-01: adds drop to list without mutating or losing existing drops', () => {
    const manager = new TripStateManager([
      { id: '1', name: 'Drop 1', address: 'Addr 1' },
      { id: '2', name: 'Drop 2', address: 'Addr 2' },
      { id: '3', name: 'Drop 3', address: 'Addr 3' },
    ]);

    expect(manager.getStops().length).toBe(3);

    // Add 4th drop (Simulating AddNewDropScreen)
    manager.addStop({ id: '4', name: 'Drop 4', address: 'Addr 4' });

    const updated = manager.getStops();
    expect(updated.length).toBe(4);
    expect(updated.map((s) => s.name)).toEqual(['Drop 1', 'Drop 2', 'Drop 3', 'Drop 4']);
  });

  it('TC-STATE-02: updates drop at specific index cleanly', () => {
    const manager = new TripStateManager([
      { id: '1', name: 'Drop 1', address: 'Addr 1' },
      { id: '2', name: 'Drop 2', address: 'Addr 2' },
    ]);

    manager.updateStop(1, { name: 'Drop 2 Updated', phone: '0812345678' });
    const stops = manager.getStops();
    expect(stops[1].name).toBe('Drop 2 Updated');
    expect(stops[1].phone).toBe('0812345678');
    expect(stops[0].name).toBe('Drop 1');
  });

  it('TC-STATE-03: reorders unvisited stops successfully', () => {
    const manager = new TripStateManager([
      { id: '1', name: 'Drop 1', address: 'Addr 1', isConfirmed: false },
      { id: '2', name: 'Drop 2', address: 'Addr 2', isConfirmed: false },
      { id: '3', name: 'Drop 3', address: 'Addr 3', isConfirmed: false },
    ]);

    const res = manager.moveUp(2); // Move Drop 3 up to position 1
    expect(res.success).toBe(true);
    expect(manager.getStops().map((s) => s.name)).toEqual(['Drop 1', 'Drop 3', 'Drop 2']);
  });

  it('TC-STATE-04: blocks reordering or moving visited/confirmed drops', () => {
    const manager = new TripStateManager([
      { id: '1', name: 'Drop 1 (Visited)', address: 'Addr 1', isConfirmed: true },
      { id: '2', name: 'Drop 2 (Pending)', address: 'Addr 2', isConfirmed: false },
      { id: '3', name: 'Drop 3 (Pending)', address: 'Addr 3', isConfirmed: false },
    ]);

    // Attempting to move Drop 1 down
    const res1 = manager.moveDown(0);
    expect(res1.success).toBe(false);
    expect(res1.error).toContain('Cannot reorder visited stop');

    // Attempting to move Drop 2 up past Drop 1
    const res2 = manager.moveUp(1);
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('Cannot reorder visited stop');

    // Order remains unchanged
    expect(manager.getStops().map((s) => s.name)).toEqual([
      'Drop 1 (Visited)',
      'Drop 2 (Pending)',
      'Drop 3 (Pending)',
    ]);
  });

  it('TC-STATE-05: blocks deleting a confirmed drop', () => {
    const manager = new TripStateManager([
      { id: '1', name: 'Drop 1 (Visited)', address: 'Addr 1', isConfirmed: true },
      { id: '2', name: 'Drop 2 (Pending)', address: 'Addr 2', isConfirmed: false },
    ]);

    const delVisited = manager.removeStop('1');
    expect(delVisited.success).toBe(false);
    expect(manager.getStops().length).toBe(2);

    const delPending = manager.removeStop('2');
    expect(delPending.success).toBe(true);
    expect(manager.getStops().length).toBe(1);
  });
});
