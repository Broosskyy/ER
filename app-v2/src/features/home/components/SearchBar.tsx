import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View } from 'react-native';

import { colorRoles } from '@/design/colors';
import { componentSize } from '@/design/layout';
import { radiusRoles } from '@/design/radii';
import { spacing, spacingRoles } from '@/design/spacing';
import { textRoles } from '@/design/typography';

export function SearchBar() {
  return (
    <View style={styles.container}>
      <Ionicons
        name="search"
        size={componentSize.iconSm}
        color={colorRoles.searchPlaceholder}
        style={styles.icon}
      />
      <TextInput
        editable={false}
        placeholder="Suche nach Events, Clubs, Künstlern…"
        placeholderTextColor={colorRoles.searchPlaceholder}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: componentSize.searchFieldHeight,
    marginHorizontal: spacingRoles.screenHorizontal,
    marginBottom: spacing.sm,
    paddingHorizontal: spacingRoles.searchPaddingHorizontal,
    borderRadius: radiusRoles.searchField,
    backgroundColor: colorRoles.searchBackground,
    borderWidth: 1,
    borderColor: colorRoles.searchBorder,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...textRoles.searchInput,
    paddingVertical: 0,
  },
});
