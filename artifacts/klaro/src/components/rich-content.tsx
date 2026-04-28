/**
 * RichContent — renders markdown-like text with:
 *  - styled tables detected from | col | syntax
 *  - bar/line charts for temporal table data (recharts)
 *  - bold (**text**), italic (_text_), bullet lists, numbered lists
 */
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ─── Table parser ─────────────────────────────────────────────────────────────

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

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

type Block = { type: "text"; content: string } | { type: "table"; content: string };

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

// ─── Numeric parser ───────────────────────────────────────────────────────────

function parseNum(val: string): number | null {
  const cleaned = val.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ─── Temporal detection ───────────────────────────────────────────────────────

const TEMPORAL_KEYWORDS = ["data", "mês", "mes", "período", "periodo", "semana", "dia", "date", "month", "week"];

function isTemporalHeader(h: string): boolean {
  return TEMPORAL_KEYWORDS.some((k) => h.toLowerCase().includes(k));
}

// ─── Chart ────────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#90f048", "#10b981", "#f59e0b", "#60a5fa", "#c084fc"];

function TableChart({ table }: { table: ParsedTable }) {
  const { headers, rows } = table;

  // Identify label column (first col, or temporal)
  const labelColIdx = headers.findIndex(isTemporalHeader) ?? 0;
  const isTemporal = labelColIdx !== -1 && isTemporalHeader(headers[labelColIdx]);

  // Numeric columns
  const numericCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== labelColIdx && rows.some((r) => parseNum(r[i] ?? "") !== null));

  if (numericCols.length === 0) return null;

  const chartData = rows.map((row) => {
    const entry: Record<string, string | number> = {
      label: row[labelColIdx] ?? "",
    };
    for (const { h, i } of numericCols) {
      const n = parseNum(row[i] ?? "");
      if (n !== null) entry[h] = n;
    }
    return entry;
  });

  const ChartComponent = isTemporal ? LineChart : BarChart;
  const DataComponent = isTemporal ? Line : Bar;

  return (
    <div className="mt-3 -mx-1">
      <ResponsiveContainer width="100%" height={180}>
        <ChartComponent data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground, #71717a)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--muted-foreground, #71717a)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            width={42}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a1f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "#fff", fontWeight: 600 }}
            itemStyle={{ color: "#a1a1aa" }}
            formatter={(value: number) => fmtBRL(value)}
          />
          {numericCols.map(({ h }, idx) =>
            isTemporal ? (
              <Line
                key={h}
                type="monotone"
                dataKey={h}
                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART_COLORS[idx % CHART_COLORS.length] }}
                activeDot={{ r: 5 }}
              />
            ) : (
              <Bar
                key={h}
                dataKey={h}
                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Styled table ─────────────────────────────────────────────────────────────

function StyledTable({ table }: { table: ParsedTable }) {
  const hasChart =
    table.rows.length >= 2 &&
    table.headers.some(isTemporalHeader) ||
    table.headers.some((_, i) => table.rows.some((r) => parseNum(r[i] ?? "") !== null));

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[rgba(255,255,255,0.03)]">
              {table.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-[var(--muted)] uppercase tracking-[0.08em] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className="border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-[rgba(255,255,255,0.02)]">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 text-white/80 ${ci > 0 ? "tabular-nums" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasChart && table.rows.length >= 2 && (
        <div className="px-3 pb-3">
          <TableChart table={table} />
        </div>
      )}
    </div>
  );
}

// ─── Inline text renderer ─────────────────────────────────────────────────────

function renderLine(ln: string, i: number): JSX.Element {
  if (!ln.trim()) return <div key={i} className="h-1.5" />;

  const parse = (s: string): (string | JSX.Element)[] => {
    const out: (string | JSX.Element)[] = [];
    let j = 0; let buf = "";
    const push = (el: JSX.Element) => { if (buf) { out.push(buf); buf = ""; } out.push(el); };
    while (j < s.length) {
      if (s[j] === "*" && s[j + 1] === "*") {
        const end = s.indexOf("**", j + 2);
        if (end > -1) { push(<strong key={j} className="text-white font-semibold">{s.slice(j + 2, end)}</strong>); j = end + 2; continue; }
      }
      if (s[j] === "_") {
        const end = s.indexOf("_", j + 1);
        if (end > -1) { push(<em key={j} className="text-white/90 italic">{s.slice(j + 1, end)}</em>); j = end + 1; continue; }
      }
      buf += s[j]; j++;
    }
    if (buf) out.push(buf);
    return out;
  };

  if (/^[•\-]\s/.test(ln)) {
    return (
      <div key={i} className="flex gap-2 pl-1">
        <span className="text-[var(--accent)] mt-[2px]">•</span>
        <span>{parse(ln.replace(/^[•\-]\s/, ""))}</span>
      </div>
    );
  }
  const m = ln.match(/^(\d+)\.\s(.*)$/);
  if (m) {
    return (
      <div key={i} className="flex gap-2 pl-1">
        <span className="text-[var(--muted)] w-4 tnum">{m[1]}.</span>
        <span>{parse(m[2])}</span>
      </div>
    );
  }
  return <div key={i}>{parse(ln)}</div>;
}

// ─── Public component ─────────────────────────────────────────────────────────

export function RichContent({ text, compact = false }: { text: string; compact?: boolean }) {
  const blocks = splitBlocks(text);

  return (
    <div className={`space-y-0.5 ${compact ? "text-[11.5px]" : "text-[12.5px]"}`}>
      {blocks.map((block, bi) => {
        if (block.type === "table") {
          const table = parseMarkdownTable(block.content);
          if (table) return <StyledTable key={bi} table={table} />;
        }
        return (
          <div key={bi} className="space-y-0.5">
            {block.content.split("\n").map((ln, li) => renderLine(ln, li))}
          </div>
        );
      })}
    </div>
  );
}

export function hasMarkdownTable(text: string): boolean {
  return /^\|.+\|$/m.test(text);
}
