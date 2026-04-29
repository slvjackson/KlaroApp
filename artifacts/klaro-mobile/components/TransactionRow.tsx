import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface TransactionRowProps {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function TransactionRow({
  description,
  amount,
  type,
  category,
  date,
  onPress,
  onLongPress,
}: TransactionRowProps) {
  const colors = useColors();
  const isIncome = type === "income";

  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);

  const formattedDate = (() => {
    try {
      const [year, month, day] = date.split("-").map(Number);
      const currentYear = new Date().getFullYear();
      const options: Intl.DateTimeFormatOptions =
        year !== currentYear
          ? { day: "2-digit", month: "short", year: "numeric" }
          : { day: "2-digit", month: "short" };
      return new Date(year, month - 1, day).toLocaleDateString("pt-BR", options);
    } catch {
      return date;
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          opacity: pressed && onPress ? 0.75 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isIncome
              ? `${colors.income}22`
              : `${colors.expense}22`,
            borderRadius: 10,
          },
        ]}
      >
        <Feather
          name={isIncome ? "arrow-down-left" : "arrow-up-right"}
          size={18}
          color={isIncome ? colors.income : colors.expense}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[styles.description, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {description}
        </Text>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>
          {category} · {formattedDate}
        </Text>
      </View>
      <Text
        style={[
          styles.amount,
          { color: isIncome ? colors.income : colors.expense },
        ]}
      >
        {isIncome ? "+" : "-"}
        {formattedAmount}
      </Text>
      {onPress && (
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 2 }} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  category: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
  },
  amount: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
