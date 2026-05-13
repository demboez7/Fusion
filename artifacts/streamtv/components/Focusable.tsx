import React, { useState } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";

interface FocusableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  pressedOpacity?: number;
  /** Border radius of the focus ring. Defaults to 10. */
  ringRadius?: number;
  /** Whether to scale slightly when focused. Defaults to true. */
  scaleOnFocus?: boolean;
  children?: React.ReactNode;
}

/**
 * Pressable wrapper that provides a clearly visible focus ring + slight
 * scale when navigated to with a TV remote / D-pad. Falls back to a normal
 * Pressable on phones (focus events are no-ops on touch devices).
 */
export function Focusable({
  style,
  focusedStyle,
  pressedOpacity = 0.75,
  ringRadius = 10,
  scaleOnFocus = true,
  children,
  ...rest
}: FocusableProps) {
  const colors = useColors();
  const { isTvMode } = useSettings();
  const [focused, setFocused] = useState(false);

  const ring: ViewStyle | null = focused && isTvMode
    ? {
        borderColor: colors.focus,
        borderWidth: 3,
        borderRadius: ringRadius,
        shadowColor: colors.focus,
        shadowOpacity: 0.7,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
        transform: scaleOnFocus ? [{ scale: 1.04 }] : undefined,
      }
    : null;

  return (
    <Pressable
      {...rest}
      onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      style={({ pressed }) => [
        style,
        ring,
        focused && focusedStyle,
        pressed && { opacity: pressedOpacity },
      ]}
    >
      {children as React.ReactNode}
    </Pressable>
  );
}

/**
 * Simple wrapper view that just shows a focus ring when its child Pressable
 * is focused. Useful when you can't easily replace the Pressable itself.
 */
export function FocusRing({ focused, radius = 10, children }: { focused: boolean; radius?: number; children: React.ReactNode }) {
  const colors = useColors();
  const { isTvMode } = useSettings();
  if (!isTvMode || !focused) return <>{children}</>;
  return (
    <View
      style={{
        borderColor: colors.focus,
        borderWidth: 3,
        borderRadius: radius,
        shadowColor: colors.focus,
        shadowOpacity: 0.7,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      {children}
    </View>
  );
}
