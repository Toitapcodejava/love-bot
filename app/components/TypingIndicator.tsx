import { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";

interface TypingIndicatorProps {
  showLabel?: boolean;
}

export function TypingIndicator({ showLabel = false }: TypingIndicatorProps) {
  const dots = [useRef(new Animated.Value(0.2)).current,
                useRef(new Animated.Value(0.2)).current,
                useRef(new Animated.Value(0.2)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center", height: 16 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{
          width: 5, height: 5, borderRadius: 3,
          backgroundColor: "#7aa2f7",
          opacity: dot,
        }} />
      ))}
      {showLabel && (
        <Text style={{ color: "#7aa2f7", fontSize: 10, marginLeft: 2 }}>đang gõ...</Text>
      )}
    </View>
  );
}
