import React from "react";
import { StyleSheet, Text, TextStyle, View } from "react-native";

interface MarkdownTextProps {
  text: string;
  color: string;
  mutedColor?: string;
  style?: TextStyle;
}

// Minimal markdown renderer — supports:
//   **bold**, *italic*, `code`, bullet lines (- / *), numbered lines (1.)
export function MarkdownText({ text, color, style }: MarkdownTextProps) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
        const numMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (bulletMatch) {
          return (
            <View key={i} style={styles.listRow}>
              <Text style={[{ color }, style]}>•  </Text>
              <Text style={[{ color, flex: 1 }, style]}>{renderInline(bulletMatch[1], color, style)}</Text>
            </View>
          );
        }
        if (numMatch) {
          return (
            <View key={i} style={styles.listRow}>
              <Text style={[{ color }, style]}>{numMatch[1]}.  </Text>
              <Text style={[{ color, flex: 1 }, style]}>{renderInline(numMatch[2], color, style)}</Text>
            </View>
          );
        }
        if (line.trim() === "") {
          return <View key={i} style={{ height: 6 }} />;
        }
        return (
          <Text key={i} style={[{ color }, style]}>
            {renderInline(line, color, style)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInline(text: string, color: string, baseStyle?: TextStyle): React.ReactNode {
  // Token splitter: **bold**, *italic*, `code`
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(pattern).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) {
      return (
        <Text
          key={i}
          style={[{ color, fontFamily: "Inter_600SemiBold" }, baseStyle]}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (/^\*.+\*$/.test(part)) {
      return (
        <Text key={i} style={[{ color, fontStyle: "italic" }, baseStyle]}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (/^`.+`$/.test(part)) {
      return (
        <Text
          key={i}
          style={[{ color, fontFamily: "Inter_500Medium" }, baseStyle]}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    return (
      <Text key={i} style={[{ color }, baseStyle]}>
        {part}
      </Text>
    );
  });
}

const styles = StyleSheet.create({
  listRow: { flexDirection: "row", alignItems: "flex-start" },
});
