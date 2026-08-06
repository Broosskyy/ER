import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { Section } from '@/components/layout/Section';
import { Stack } from '@/components/layout/Stack';
import { CategoryChip } from '@/components/discovery/CategoryChip';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

import type { EntityProfileAboutContent } from '../utils/entity-profile-about';

export interface EntityProfileAboutSectionProps {
  content: EntityProfileAboutContent;
}

export function EntityProfileAboutSection({ content }: EntityProfileAboutSectionProps) {
  const { theme } = useTheme();

  return (
    <Stack gap="lg">
      {content.description ? (
        <Section title="Beschreibung">
          <AppText role="body">{content.description}</AppText>
        </Section>
      ) : null}

      {content.locationLabel ? (
        <Section title="Standort">
          <AppText role="bodyMuted" color={theme.colors.textSecondary}>
            {content.locationLabel}
          </AppText>
        </Section>
      ) : null}

      {content.genreLabels.length > 0 ? (
        <Section title="Genres">
          <View style={styles.chips}>
            {content.genreLabels.map((genre) => (
              <CategoryChip key={genre} label={genre} />
            ))}
          </View>
        </Section>
      ) : null}

      {content.socialLinks.length > 0 ? (
        <Section title="Links">
          <Stack gap="sm">
            {content.socialLinks.map((link) => (
              <Pressable
                key={link.id}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                onPress={() => void Linking.openURL(link.url)}
                style={styles.linkRow}
              >
                <AppText role="bodyStrong" color={theme.colors.accent}>
                  {link.label}
                </AppText>
                <AppText role="caption" color={theme.colors.textSecondary} numberOfLines={1}>
                  {link.url}
                </AppText>
              </Pressable>
            ))}
          </Stack>
        </Section>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  linkRow: {
    gap: spacing.xs,
  },
});
