import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const PHASES = [
  { after: 0,  title: "Analisando transações…",       sub: "A IA está lendo seu histórico financeiro." },
  { after: 5,  title: "Identificando padrões…",       sub: "Encontrando tendências e anomalias nos seus dados." },
  { after: 14, title: "Gerando recomendações…",       sub: "Elaborando insights personalizados para o seu negócio." },
  { after: 28, title: "Quase pronto…",                sub: "Finalizando as análises. Só mais um instante!" },
  { after: 50, title: "Ainda processando…",           sub: "Análises mais complexas levam um pouco mais." },
];

export function GeneratingInsightsOverlay() {
  const colors = useColors();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1800, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const phase = PHASES.reduce(
    (cur, p) => (elapsed >= p.after ? p : cur),
    PHASES[0]!
  );

  return (
    <Modal visible transparent animationType="fade">
      <View style={[styles.root, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `${colors.primary}20`, borderRadius: 40 },
              ]}
            >
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={40}
                color={colors.primary}
              />
            </View>
          </Animated.View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {phase.title}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {phase.sub}
          </Text>

          <Animated.View style={{ transform: [{ rotate }], marginTop: 20 }}>
            <Feather name="loader" size={22} color={colors.primary} />
          </Animated.View>

          {elapsed >= 5 && (
            <Text style={[styles.timer, { color: colors.mutedForeground }]}>
              {elapsed}s
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  timer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    opacity: 0.5,
  },
});
