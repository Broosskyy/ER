import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { IconButton } from '@/components/buttons/IconButton';
import { AppText } from '@/components/layout/AppText';
import { spacing } from '@/design/spacing';
import { useTheme } from '@/design/theme';

export interface FlyerGalleryViewerProps {
  visible: boolean;
  imageUrls: string[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

const ZOOM_LEVELS = [1, 2, 3] as const;

export function FlyerGalleryViewer({
  visible,
  imageUrls,
  initialIndex = 0,
  title,
  onClose,
}: FlyerGalleryViewerProps) {
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState<(typeof ZOOM_LEVELS)[number]>(1);
  const urls = useMemo(() => imageUrls.filter((url) => Boolean(url?.trim())), [imageUrls]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setActiveIndex(initialIndex);
    setZoomLevel(1);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [visible, initialIndex]);

  const activeUrl = urls[activeIndex];

  const handleShare = useCallback(async () => {
    if (!activeUrl) {
      return;
    }
    try {
      await Share.share(
        Platform.OS === 'web'
          ? { message: activeUrl, url: activeUrl }
          : { message: title ? `${title}\n${activeUrl}` : activeUrl, url: activeUrl },
      );
    } catch {
      // User dismissed share sheet.
    }
  }, [activeUrl, title]);

  const handleSave = useCallback(async () => {
    if (!activeUrl) {
      return;
    }
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = activeUrl;
      anchor.download = 'flyer.jpg';
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
      return;
    }
    await Linking.openURL(activeUrl);
  }, [activeUrl]);

  const handleLongPress = useCallback(() => {
    Alert.alert('Flyer', undefined, [
      { text: 'Teilen', onPress: () => void handleShare() },
      { text: 'Speichern', onPress: () => void handleSave() },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }, [handleSave, handleShare]);

  const toggleZoom = useCallback(() => {
    setZoomLevel((current) => {
      const index = ZOOM_LEVELS.indexOf(current);
      return ZOOM_LEVELS[(index + 1) % ZOOM_LEVELS.length] ?? 1;
    });
  }, []);

  const onMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(nextIndex);
    setZoomLevel(1);
  }, [width]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <Pressable
        style={{ width, height: height * 0.75 }}
        onPress={toggleZoom}
        onLongPress={handleLongPress}
        accessibilityRole="imagebutton"
        accessibilityLabel="Flyer vergrößern"
      >
        <Image
          source={{ uri: item }}
          style={[
            styles.image,
            {
              transform: [{ scale: zoomLevel }],
            },
          ]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Pressable>
    ),
    [handleLongPress, height, toggleZoom, width, zoomLevel],
  );

  if (urls.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.colors.overlay }]}>
        <View style={styles.toolbar}>
          <IconButton icon="close" accessibilityLabel="Schließen" onPress={onClose} />
          <View style={styles.toolbarCenter}>
            {title ? (
              <AppText role="label" color={theme.colors.textOnAccent}>
                {title}
              </AppText>
            ) : null}
            {urls.length > 1 ? (
              <AppText role="caption" color={theme.colors.textOnAccent}>
                {activeIndex + 1} / {urls.length}
              </AppText>
            ) : null}
          </View>
          <View style={styles.toolbarActions}>
            <IconButton icon="share-outline" accessibilityLabel="Flyer teilen" onPress={() => void handleShare()} />
            <IconButton icon="download-outline" accessibilityLabel="Flyer speichern" onPress={() => void handleSave()} />
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={urls}
          horizontal
          pagingEnabled
          keyExtractor={(item, index) => `${item}-${index}`}
          renderItem={renderItem}
          onMomentumScrollEnd={onMomentumScrollEnd}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          initialScrollIndex={initialIndex}
          onScrollToIndexFailed={() => undefined}
        />

        {urls.length > 1 ? (
          <View style={styles.pagination}>
            {urls.map((url, index) => (
              <View
                key={url}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      index === activeIndex ? theme.colors.accent : theme.colors.textSecondary,
                    opacity: index === activeIndex ? 1 : 0.4,
                  },
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  toolbar: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarCenter: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    position: 'absolute',
    bottom: spacing.xl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
