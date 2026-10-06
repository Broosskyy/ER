import { describe, expect, it } from 'vitest';

import { resolveMapPinStyle } from '@/components/map/map-styles';
import type { MapClusterViewModel, MapPinViewModel } from '@/components/map/view-models';
import { darkTheme } from '@/design/theme/dark';
import { lightTheme } from '@/design/theme/light';

describe('Phase 2D map display contracts', () => {
  it('resolves every supported pin status with semantic theme colors', () => {
    for (const status of ['default', 'selected', 'today', 'sold_out', 'cancelled'] as const) {
      expect(resolveMapPinStyle(lightTheme, status).backgroundColor).not.toHaveLength(0);
    }
    expect(resolveMapPinStyle(darkTheme, 'selected').backgroundColor).toBe(darkTheme.colors.accent);
    expect(resolveMapPinStyle(lightTheme, 'sold_out').badgeStatus).toBe('error');
  });

  it('keeps pin and cluster models presentation-only', () => {
    const pin: MapPinViewModel = { id: 'void', status: 'today', label: 'ab 15 €', accessibilityLabel: 'VOID Club heute' };
    const cluster: MapClusterViewModel = { id: 'mitte', count: 8, accessibilityLabel: '8 Events in Mitte' };
    expect('latitude' in pin).toBe(false);
    expect('onPress' in cluster).toBe(false);
    expect(cluster.count).toBe(8);
  });
});
