import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  width?: number;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function ShimmerCard({ width = 120, height = 180, borderRadius = 8, style }: Props) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.shimmer,
        { width, height, borderRadius, backgroundColor: colors.muted, opacity },
        style,
      ]}
    />
  );
}

export function ShimmerRow() {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.item}>
          <ShimmerCard width={120} height={180} />
          <ShimmerCard width={100} height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {},
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
  },
  item: {
    gap: 6,
  },
});
