import React from "react";
import { ScrollView, StyleSheet, Text, TextStyle, View } from "react-native";
import Svg, {
  Circle,
  Line as SvgLine,
  Path,
  Text as SvgText,
} from "react-native-svg";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

type Block = { type: "text"; content: string } | { type: "table"; content: string };

// ─── Table parser ─────────────────────────────────────────────────────────────

function parseRow(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function parseMarkdownTable(block: string): ParsedTable | null {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));
  if (lines.length < 3) return null;
  const sepIdx = lines.findIndex((l) => /^\|[\s\-:|]+\|$/.test(l));
  if (sepIdx !== 1) return null;
  return {
    headers: parseRow(lines[0]),
    rows: lines.slice(2).map(parseRow),
  };
}

// ─── Block splitter ───────────────────────────────────────────────────────────

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let buf: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const isTableLine = /^\|.+\|$/.test(line.trim());
    if (isTableLine && !inTable) {
      if (buf.length) { blocks.push({ type: "text", content: buf.join("\n") }); buf = []; }
      inTable = true;
      buf = [line];
    } else if (isTableLine && inTable) {
      buf.push(line);
    } else if (!isTableLine && inTable) {
      blocks.push({ type: "table", content: buf.join("\n") });
      buf = [line];
      inTable = false;
    } else {
      buf.push(line);
    }
  }
  if (buf.length) blocks.push({ type: inTable ? "table" : "text", content: buf.join("\n") });
  return blocks;
}

// ─── Numeric helpers ──────────────────────────────────────────────────────────

function parseNum(val: string): number | null {
  const cleaned = val
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/\*\*/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
}

// ─── Temporal detection ───────────────────────────────────────────────────────

const TEMPORAL_KW = ["mês", "mes", "período", "periodo", "semana", "dia", "data", "month", "week"];

function isTemporal(h: string): boolean {
  return TEMPORAL_KW.some((k) => h.toLowerCase().includes(k));
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CHART_COLORS = ["#6af82f", "#10b981", "#f59e0b", "#60a5fa", "#c084fc"];

function SvgLineChart({
  data,
  numericCols,
  mutedColor,
}: {
  data: Record<string, string | number>[];
  numericCols: { h: string }[];
  mutedColor: string;
}) {
  const W = 320;
  const H = 150;
  const PAD = { top: 8, right: 8, bottom: 28, left: 42 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const allVals: number[] = [];
  for (const col of numericCols) {
    for (const row of data) {
      const v = row[col.h];
      if (typeof v === "number") allVals.push(v);
    }
  }
  if (allVals.length === 0) return null;

  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const range = maxVal - minVal || 1;
  const xStep = cW / Math.max(data.length - 1, 1);

  const toX = (i: number) => PAD.left + i * xStep;
  const toY = (v: number) => PAD.top + cH - ((v - minVal) / range) * cH;

  const gridVals = [0, 0.5, 1].map((t) => minVal + t * range);

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {gridVals.map((val, i) => {
        const y = toY(val);
        return (
          <React.Fragment key={i}>
            <SvgLine
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1}
            />
            <SvgText x={PAD.left - 4} y={y + 3} fill={mutedColor} fontSize={8} textAnchor="end">
              {fmtK(val)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {data.map((row, i) => (
        <SvgText key={i} x={toX(i)} y={H - 4} fill={mutedColor} fontSize={8} textAnchor="middle">
          {String(row.label ?? "").slice(0, 8)}
        </SvgText>
      ))}

      {numericCols.map(({ h }, ci) => {
        const color = CHART_COLORS[ci % CHART_COLORS.length];
        const pts: string[] = [];
        data.forEach((row, i) => {
          const v = row[h];
          if (typeof v === "number") pts.push(`${toX(i)},${toY(v)}`);
        });
        if (pts.length < 2) return null;
        return (
          <React.Fragment key={h}>
            <Path
              d={`M ${pts.join(" L ")}`}
              stroke={color} strokeWidth={2} fill="none"
              strokeLinecap="round" strokeLinejoin="round"
            />
            {data.map((row, i) => {
              const v = row[h];
              if (typeof v !== "number") return null;
              return <Circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={color} />;
            })}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Native Table ─────────────────────────────────────────────────────────────

function NativeTable({
  table,
  color,
  mutedColor,
  cardColor,
  borderColor,
}: {
  table: ParsedTable;
  color: string;
  mutedColor: string;
  cardColor: string;
  borderColor: string;
}) {
  const labelColIdx = (() => {
    const idx = table.headers.findIndex(isTemporal);
    return idx !== -1 ? idx : 0;
  })();

  const numericCols = table.headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== labelColIdx && table.rows.some((r) => parseNum(r[i] ?? "") !== null));

  const chartData = table.rows.map((row) => {
    const entry: Record<string, string | number> = { label: row[labelColIdx] ?? "" };
    for (const { h, i } of numericCols) {
      const n = parseNum(row[i] ?? "");
      if (n !== null) entry[h] = n;
    }
    return entry;
  });

  const hasChart = numericCols.length > 0 && table.rows.length >= 2 && table.headers.some(isTemporal);

  return (
    <View style={[styles.tableContainer, { borderColor, backgroundColor: cardColor }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header row */}
          <View style={[styles.tableRow, { backgroundColor: `${borderColor}60`, borderBottomWidth: 1, borderBottomColor: borderColor }]}>
            {table.headers.map((h, i) => (
              <View key={i} style={styles.tableCell}>
                <Text style={[styles.tableHeaderText, { color: mutedColor }]} numberOfLines={1}>
                  {h.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
          {/* Data rows */}
          {table.rows.map((row, ri) => (
            <View
              key={ri}
              style={[
                styles.tableRow,
                ri < table.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: `${borderColor}40` },
              ]}
            >
              {row.map((cell, ci) => (
                <View key={ci} style={styles.tableCell}>
                  <Text
                    style={[
                      styles.tableCellText,
                      { color: ci === 0 ? color : color + "cc" },
                      ci > 0 && { fontFamily: "Inter_500Medium" },
                    ]}
                  >
                    {cell}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {hasChart && (
        <View style={[styles.chartWrap, { borderTopColor: borderColor }]}>
          <SvgLineChart data={chartData} numericCols={numericCols} mutedColor={mutedColor} />
        </View>
      )}
    </View>
  );
}

// ─── Inline renderer ──────────────────────────────────────────────────────────

function renderInline(text: string, color: string, baseStyle?: TextStyle): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).filter(Boolean);
  return parts.map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part))
      return <Text key={i} style={[{ color, fontFamily: "Inter_600SemiBold" }, baseStyle]}>{part.slice(2, -2)}</Text>;
    if (/^\*.+\*$/.test(part))
      return <Text key={i} style={[{ color, fontStyle: "italic" }, baseStyle]}>{part.slice(1, -1)}</Text>;
    if (/^`.+`$/.test(part))
      return <Text key={i} style={[{ color, fontFamily: "Inter_500Medium" }, baseStyle]}>{part.slice(1, -1)}</Text>;
    return <Text key={i} style={[{ color }, baseStyle]}>{part}</Text>;
  });
}

// ─── Public component ─────────────────────────────────────────────────────────

interface MarkdownTextProps {
  text: string;
  color: string;
  mutedColor?: string;
  cardColor?: string;
  borderColor?: string;
  style?: TextStyle;
}

export function MarkdownText({
  text,
  color,
  mutedColor = "#888888",
  cardColor = "rgba(255,255,255,0.04)",
  borderColor = "rgba(255,255,255,0.10)",
  style,
}: MarkdownTextProps) {
  const blocks = splitBlocks(text);

  return (
    <View style={{ gap: 2 }}>
      {blocks.map((block, bi) => {
        if (block.type === "table") {
          const table = parseMarkdownTable(block.content);
          if (table)
            return (
              <NativeTable
                key={bi}
                table={table}
                color={color}
                mutedColor={mutedColor}
                cardColor={cardColor}
                borderColor={borderColor}
              />
            );
        }

        const lines = block.content.split("\n");
        return (
          <View key={bi} style={{ gap: 2 }}>
            {lines.map((line, li) => {
              const h3 = line.match(/^###\s+(.*)/);
              if (h3) return <Text key={li} style={[styles.h3, { color }, style]}>{renderInline(h3[1], color)}</Text>;

              const h2 = line.match(/^##\s+(.*)/);
              if (h2) return <Text key={li} style={[styles.h2, { color }, style]}>{renderInline(h2[1], color)}</Text>;

              const bq = line.match(/^>\s*(.*)/);
              if (bq)
                return (
                  <View key={li} style={[styles.blockquote, { borderLeftColor: mutedColor }]}>
                    <Text style={[{ color: mutedColor }, style]}>{renderInline(bq[1], mutedColor, style)}</Text>
                  </View>
                );

              if (/^---+$/.test(line.trim()))
                return <View key={li} style={[styles.hr, { backgroundColor: borderColor }]} />;

              const bullet = line.match(/^\s*[-*•]\s+(.*)/);
              if (bullet)
                return (
                  <View key={li} style={styles.listRow}>
                    <Text style={[styles.bullet, { color: mutedColor }]}>•</Text>
                    <Text style={[{ color, flex: 1 }, style]}>{renderInline(bullet[1], color, style)}</Text>
                  </View>
                );

              const num = line.match(/^\s*(\d+)\.\s+(.*)/);
              if (num)
                return (
                  <View key={li} style={styles.listRow}>
                    <Text style={[styles.bullet, { color: mutedColor }]}>{num[1]}.</Text>
                    <Text style={[{ color, flex: 1 }, style]}>{renderInline(num[2], color, style)}</Text>
                  </View>
                );

              if (!line.trim()) return <View key={li} style={{ height: 6 }} />;

              return (
                <Text key={li} style={[{ color }, style]}>
                  {renderInline(line, color, style)}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.3, marginTop: 6, marginBottom: 2 },
  h3: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 6, marginBottom: 2 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  bullet: { fontSize: 14, lineHeight: 22, minWidth: 16 },
  blockquote: { borderLeftWidth: 3, paddingLeft: 10, marginVertical: 2 },
  hr: { height: 1, marginVertical: 8 },

  tableContainer: { borderRadius: 10, borderWidth: 1, overflow: "hidden", marginVertical: 6 },
  tableRow: { flexDirection: "row" },
  tableCell: { paddingHorizontal: 10, paddingVertical: 8, minWidth: 88 },
  tableHeaderText: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  tableCellText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  chartWrap: { borderTopWidth: 1, paddingHorizontal: 6, paddingVertical: 8 },
});
