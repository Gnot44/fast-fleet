import { describe, it, expect } from 'vitest';

export function calculateEffectiveOdometer(
  startOdometer: number | string,
  drops: Array<{ odometer?: number | string; odometer_reading?: number | string; isConfirmed?: boolean; status?: string }>,
  dbCurrentOdometer?: number | null
): number {
  const startNum = parseFloat(String(startOdometer).replace(/,/g, '')) || 0;

  if (Array.isArray(drops) && drops.length > 0) {
    const confirmedDrops = drops.filter(
      (d) => d.isConfirmed || d.status === 'completed' || d.status === 'Completed'
    );

    for (let i = confirmedDrops.length - 1; i >= 0; i--) {
      const d = confirmedDrops[i];
      const rawVal =
        d.odometer !== undefined && d.odometer !== null && d.odometer !== ''
          ? d.odometer
          : d.odometer_reading !== undefined && d.odometer_reading !== null && d.odometer_reading !== ''
          ? d.odometer_reading
          : null;

      if (rawVal !== null && rawVal !== undefined) {
        const num = parseFloat(String(rawVal).replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
          return num;
        }
      }
    }
  }

  if (dbCurrentOdometer !== null && dbCurrentOdometer !== undefined && !isNaN(Number(dbCurrentOdometer)) && Number(dbCurrentOdometer) > 0) {
    return Number(dbCurrentOdometer);
  }

  return startNum;
}

export function validateTripCompletion(
  startOdometer: number,
  endOdometer: number
): { isValid: boolean; totalDistanceKm: number; errorMessage?: string } {
  if (isNaN(endOdometer) || endOdometer <= 0) {
    return { isValid: false, totalDistanceKm: 0, errorMessage: 'Invalid end odometer reading' };
  }
  if (endOdometer < startOdometer) {
    return {
      isValid: false,
      totalDistanceKm: 0,
      errorMessage: `End odometer (${endOdometer}) cannot be less than start odometer (${startOdometer})`,
    };
  }

  const distance = Math.round((endOdometer - startOdometer) * 100) / 100;
  return { isValid: true, totalDistanceKm: distance };
}

describe('Odometer Logic & Math Calculation Tests', () => {
  it('TC-ODO-01: calculates effective odometer from latest confirmed drop', () => {
    const startOdo = 45200;
    const drops = [
      { isConfirmed: true, odometer: '45215' },   // Drop 1 finished at 45,215 km
      { isConfirmed: true, odometer: '45230' },   // Drop 2 finished at 45,230 km
      { isConfirmed: false, odometer: '' },       // Drop 3 pending
    ];

    const currentOdo = calculateEffectiveOdometer(startOdo, drops);
    expect(currentOdo).toBe(45230);
  });

  it('TC-ODO-02: falls back to start odometer when no drops are confirmed', () => {
    const startOdo = '45,200';
    const drops = [
      { isConfirmed: false, odometer: '' },
      { isConfirmed: false, odometer: '' },
    ];

    const currentOdo = calculateEffectiveOdometer(startOdo, drops);
    expect(currentOdo).toBe(45200);
  });

  it('TC-ODO-03: validates trip completion distance calculation', () => {
    const startOdo = 45200;
    const endOdo = 45284.5;
    const result = validateTripCompletion(startOdo, endOdo);

    expect(result.isValid).toBe(true);
    expect(result.totalDistanceKm).toBe(84.5);
  });

  it('TC-ODO-04: rejects invalid end odometer lower than start odometer', () => {
    const startOdo = 45200;
    const endOdo = 45150; // Typo entered by driver
    const result = validateTripCompletion(startOdo, endOdo);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('cannot be less than start odometer');
  });
});
