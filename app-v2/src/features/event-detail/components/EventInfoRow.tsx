import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/layout/AppText';
import { colors } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { spacing } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export interface EventInfoRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}

export function EventInfoRow({ icon, label, value }: EventInfoRowProps) {
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={componentSize.iconSm} color={colors.primary} />
      <View style={styles.textWrap}>
        <AppText role="bodyMuted" style={styles.label}>{label}</AppText>
        <AppText role="body" style={styles.value}>{value}</AppText>
      </View>
    </View>
  );
}

export interface EventSectionProps {
  title?: string;
  children: ReactNode;
}

export function EventSection({ title, children }: EventSectionProps) {
  return (
    <View style={styles.section}>
      {title ? <AppText role="sectionTitle" style={styles.title}>{title}</AppText> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontSize: textRoles.metadata.fontSize,
  },
  value: {
    fontSize: textRoles.body.fontSize,
  },
  section: {
    gap: spacing.md,
  },
  title: {
    fontSize: textRoles.sectionTitle.fontSize,
  },
});
