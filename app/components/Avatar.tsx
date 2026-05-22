import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export type Mood = "neutral" | "annoyed" | "concerned" | "smug" | "warm" | "thinking";

const MOOD_EMOJI: Record<Mood, string> = {
  neutral:   "😒",
  annoyed:   "😤",
  concerned: "🥺",
  smug:      "😏",
  warm:      "💜",
  thinking:  "🤔",
};

interface AvatarProps {
  mood: Mood;
  streaming: boolean;
  size?: number;
}

export function Avatar({ mood, streaming, size = 42 }: AvatarProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const prevMood = useRef<Mood>(mood);

  useEffect(() => {
    if (streaming) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [streaming]);

  useEffect(() => {
    if (prevMood.current !== mood) {
      prevMood.current = mood;
      Animated.sequence([
        Animated.timing(badgeScale, { toValue: 0, duration: 80, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [mood]);

  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
  const glowScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const badgeSize = Math.round(size * 0.43);

  return (
    <View style={{ width: size + 16, height: size + 16, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: (size + 16) / 2,
          backgroundColor: "#7aa2f7",
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
        }
      ]} />
      <LinearGradient
        colors={["#7aa2f7", "#bb9af7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: size, height: size, borderRadius: size / 2,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.52 }}>🌙</Text>
      </LinearGradient>
      <Animated.View style={{
        position: "absolute", bottom: 2, right: 2,
        width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2,
        backgroundColor: "#0d0d1a", borderWidth: 1, borderColor: "#1a1a2e",
        alignItems: "center", justifyContent: "center",
        transform: [{ scale: badgeScale }],
      }}>
        <Text style={{ fontSize: badgeSize * 0.62 }}>{MOOD_EMOJI[mood]}</Text>
      </Animated.View>
    </View>
  );
}
