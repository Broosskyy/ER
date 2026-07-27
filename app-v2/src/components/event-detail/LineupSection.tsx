import { StyleSheet, View, ViewStyle } from 'react-native';

import { LineupItem } from '@/components/discovery/LineupItem';
import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { LineupSectionViewModel } from './view-models';

export interface LineupSectionProps {
  lineup: LineupSectionViewModel;
  title?: string;
  onArtistPress?: (name: string) => void;
  style?: ViewStyle;
  testID?: string;
}

/** Mockup 11 line-up block with TBA fallback. */
export function LineupSection({
  lineup,
  title = 'Line-up',
  onArtistPress,
  style,
  testID,
}: LineupSectionProps) {
  const { theme } = useTheme();

  return (
    <Section title={title} style={style} testID={testID}>
      {lineup.tba || lineup.artists.length === 0 ? (
        <AppText role="bodyMuted" color={theme.colors.textSecondary}>
          TBA
        </AppText>
      ) : (
        <Stack gap="sm">
          {lineup.artists.map((artist) => (
            <LineupItem
              key={artist.name}
              artist={artist}
              onPress={onArtistPress ? () => onArtistPress(artist.name) : undefined}
            />
          ))}
        </Stack>
      )}
    </Section>
  );
}
