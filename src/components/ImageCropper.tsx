import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Image,
  PanResponder,
  Animated,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

interface ImageCropperProps {
  visible: boolean;
  imageUri: string;
  aspectRatio?: number; // width/height, default 3/4 = 0.75
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const ImageCropper: React.FC<ImageCropperProps> = ({
  visible,
  imageUri,
  aspectRatio = 3 / 4,
  onCrop,
  onCancel,
}) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropBoxSize, setCropBoxSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(1);

  const pan = useRef(new Animated.ValueXY()).current;
  const lastPan = useRef({ x: 0, y: 0 });
  const lastScale = useRef(1);
  const lastDistance = useRef(0);
  const cropContainerRef = useRef<View>(null);

  // Calculate crop box size based on screen
  useEffect(() => {
    const maxWidth = SCREEN_WIDTH * 0.8;
    const maxHeight = SCREEN_HEIGHT * 0.5;

    let boxWidth = maxWidth;
    let boxHeight = boxWidth / aspectRatio;

    if (boxHeight > maxHeight) {
      boxHeight = maxHeight;
      boxWidth = boxHeight * aspectRatio;
    }

    setCropBoxSize({ width: boxWidth, height: boxHeight });
    setContainerSize({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.65 });
  }, [aspectRatio]);

  // Load image dimensions
  useEffect(() => {
    if (imageUri && cropBoxSize.width > 0) {
      Image.getSize(
        imageUri,
        (width, height) => {
          setImageSize({ width, height });
          // Calculate initial scale to fit image in crop box
          const scaleX = cropBoxSize.width / width;
          const scaleY = cropBoxSize.height / height;
          const initialScale = Math.max(scaleX, scaleY) * 1.2; // 20% larger for room to move
          setScale(initialScale);
          lastScale.current = initialScale;
          pan.setValue({ x: 0, y: 0 });
          lastPan.current = { x: 0, y: 0 };
        },
        (error) => console.error('Failed to get image size:', error)
      );
    }
  }, [imageUri, cropBoxSize]);

  // Web: Mouse wheel zoom
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.min(Math.max(scale + delta, 0.5), 4);
        setScale(newScale);
        lastScale.current = newScale;
      };

      window.addEventListener('wheel', handleWheel, { passive: false });
      return () => window.removeEventListener('wheel', handleWheel);
    }
  }, [visible, scale]);

  const getDistance = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          lastDistance.current = getDistance(evt.nativeEvent.touches);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 2) {
          // Pinch to zoom
          const distance = getDistance(evt.nativeEvent.touches);
          if (lastDistance.current > 0) {
            const newScale = lastScale.current * (distance / lastDistance.current);
            const clampedScale = Math.min(Math.max(newScale, 0.5), 4);
            setScale(clampedScale);
          }
        } else {
          // Pan
          const newX = lastPan.current.x + gestureState.dx;
          const newY = lastPan.current.y + gestureState.dy;
          pan.setValue({ x: newX, y: newY });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length < 2) {
          lastPan.current = {
            x: lastPan.current.x + gestureState.dx,
            y: lastPan.current.y + gestureState.dy,
          };
          lastScale.current = scale;
          lastDistance.current = 0;
        }
      },
    })
  ).current;

  // Zoom functions for buttons
  const zoomIn = () => {
    const newScale = Math.min(scale + 0.2, 4);
    setScale(newScale);
    lastScale.current = newScale;
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.2, 0.5);
    setScale(newScale);
    lastScale.current = newScale;
  };

  const handleCrop = async () => {
    if (!imageSize.width || !imageSize.height) return;

    setLoading(true);
    try {
      // Calculate crop region in original image coordinates
      const displayedWidth = imageSize.width * scale;
      const displayedHeight = imageSize.height * scale;

      // Center of the displayed image relative to crop box center
      const offsetX = -lastPan.current.x;
      const offsetY = -lastPan.current.y;

      // Crop box position in displayed image coordinates
      const cropX = (displayedWidth / 2) - (cropBoxSize.width / 2) + offsetX;
      const cropY = (displayedHeight / 2) - (cropBoxSize.height / 2) + offsetY;

      // Convert to original image coordinates
      const originX = Math.max(0, cropX / scale);
      const originY = Math.max(0, cropY / scale);
      const cropWidth = Math.min(cropBoxSize.width / scale, imageSize.width - originX);
      const cropHeight = Math.min(cropBoxSize.height / scale, imageSize.height - originY);

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.round(originX),
              originY: Math.round(originY),
              width: Math.round(cropWidth),
              height: Math.round(cropHeight),
            },
          },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      onCrop(result.uri);
    } catch (error) {
      console.error('Crop error:', error);
      // Fallback: return original image
      onCrop(imageUri);
    } finally {
      setLoading(false);
    }
  };

  const displayWidth = imageSize.width * scale;
  const displayHeight = imageSize.height * scale;

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Foto anpassen</Text>
          <View style={styles.headerButton} />
        </View>

        {/* Instruction */}
        <Text style={styles.instruction}>
          Verschiebe das Bild, um den Ausschnitt anzupassen
        </Text>

        {/* Crop Area */}
        <View style={styles.cropContainer} ref={cropContainerRef}>
          {/* Image */}
          <Animated.View
            style={[
              styles.imageContainer,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: displayWidth,
                  height: displayHeight,
                }}
                resizeMode="contain"
              />
            ) : null}
          </Animated.View>

          {/* Overlay with cutout */}
          <View style={styles.overlayContainer} pointerEvents="none">
            {/* Top overlay */}
            <View style={[styles.overlay, {
              height: (containerSize.height - cropBoxSize.height) / 2,
              width: '100%',
            }]} />

            {/* Middle row */}
            <View style={styles.middleRow}>
              {/* Left overlay */}
              <View style={[styles.overlay, {
                width: (SCREEN_WIDTH - cropBoxSize.width) / 2,
                height: cropBoxSize.height,
              }]} />

              {/* Crop box (transparent) */}
              <View style={[styles.cropBox, {
                width: cropBoxSize.width,
                height: cropBoxSize.height,
              }]} />

              {/* Right overlay */}
              <View style={[styles.overlay, {
                width: (SCREEN_WIDTH - cropBoxSize.width) / 2,
                height: cropBoxSize.height,
              }]} />
            </View>

            {/* Bottom overlay */}
            <View style={[styles.overlay, {
              height: (containerSize.height - cropBoxSize.height) / 2,
              width: '100%',
            }]} />
          </View>
        </View>

        {/* Zoom Controls */}
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
            <Text style={styles.zoomButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{Math.round(scale * 100)}%</Text>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Zoom hint */}
        <Text style={styles.zoomHint}>
          {Platform.OS === 'web' ? 'Mausrad oder Buttons zum Zoomen' : 'Mit zwei Fingern zoomen'}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.buttonDisabled]}
            onPress={handleCrop}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.confirmText}>Fertig</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  headerButton: {
    width: 80,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  cancelText: {
    color: '#007AFF',
    fontSize: 17,
  },
  instruction: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  cropContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  cropBox: {
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  zoomLevel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    minWidth: 60,
    textAlign: 'center',
  },
  zoomHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ImageCropper;
