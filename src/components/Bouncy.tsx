import { forwardRef, type ReactNode } from 'react';
import { Pressable, type HostInstance, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion } from '../theme/tokens';

const APressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  haptic?: boolean;
  scaleTo?: number;
};

/** Pressable that springs down on press and back on release, with optional haptics. */
export const Bouncy = forwardRef<HostInstance, Props>(function Bouncy({ style, children, haptic = true, scaleTo = 0.94, onPressIn, onPressOut, onPress, ...rest }, ref) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <APressable
      ref={ref}
      {...rest}
      onPressIn={(e) => { scale.value = withSpring(scaleTo, motion.spring); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, motion.spring); onPressOut?.(e); }}
      onPress={(e) => {
        if (haptic && process.env.EXPO_OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </APressable>
  );
});
