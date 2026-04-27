import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTransactionsQueryKey } from "@workspace/api-client-react";
import { Loader2, Trash2, X, Plus, Check } from "lucide-react";

export interface TransactionData {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  sourceFileName?: string | null;
}

interface Props {
  open: boolean;
  editing: TransactionData | null;
  onClose: () => void;
}

function isoToBR(iso: string) {
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return "";
  return `${day}/${m}/${y}`;
}

function brToISO(br: string) {
  const [day, month, year] = br.split("/");
  if (!day || !month || !year || year.length < 4) return null;
  const d = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function todayBR() {
  return isoToBR(new Date().toISOString());
}

export function TransactionDialog({ open, editing, onClose }: Props) {
  const queryClient = useQueryClient();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayBR());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Categories
  const [existingCats, setExistingCats] = useState<string[]>([]);
  const [suggestedCats, setSuggestedCats] = useState<string[]>([]);
  const [sessionCats, setSessionCats] = useState<string[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);

  const isEdit = editing !== null;

  // Fetch dynamic categories when dialog opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/transactions/categories")
      .then((r) => r.json())
      .then((d) => {
        setExistingCats(d.existing ?? []);
        setSuggestedCats(d.suggestions ?? []);
      })
      .catch(() => {});
  }, [open]);

  // Reset form
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setType(editing.type);
      setCategory(editing.category);
      setDate(isoToBR(editing.date));
    } else {
      setDescription("");
      setAmount("");
      setType("expense");
      setCategory("");
      setDate(todayBR());
    }
    setSessionCats([]);
    setAddingCustom(false);
    setCustomInput("");
    setError("");
  }, [open, editing]);

  // Focus custom input when it appears
  useEffect(() => {
    if (addingCustom) customInputRef.current?.focus();
  }, [addingCustom]);

  // All chips: existing → session-added → (editing category if not in list)
  const allChips = useMemo(() => {
    const seen = new Set([...existingCats, ...sessionCats].map((c) => c.toLowerCase()));
    const extra: string[] = [];
    if (editing?.category && !seen.has(editing.category.toLowerCase())) {
      extra.push(editing.category);
    }
    return [...existingCats, ...sessionCats, ...extra];
  }, [existingCats, sessionCats, editing]);

  // Suggestions not already in allChips
  const visibleSuggestions = useMemo(() => {
    const seen = new Set(allChips.map((c) => c.toLowerCase()));
    return suggestedCats.filter((c) => !seen.has(c.toLowerCase()));
  }, [allChips, suggestedCats]);

  function confirmCustom() {
    const val = customInput.trim();
    setAddingCustom(false);
    setCustomInput("");
    if (!val) return;
    const lower = val.toLowerCase();
    const alreadyIn = [...existingCats, ...sessionCats].some((c) => c.toLowerCase() === lower);
    if (!alreadyIn) setSessionCats((prev) => [...prev, val]);
    setCategory(val);
  }

  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);

  function requestSave() {
    const trimDesc = description.trim();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!trimDesc) { setError("Informe uma descrição."); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError("Valor inválido."); return; }
    if (!category) { setError("Selecione uma categoria."); return; }
    const isoDate = brToISO(date);
    if (!isoDate) { setError("Data inválida. Use dd/mm/aaaa."); return; }
    setError("");
    setPendingAction("save");
  }

  function requestDelete() {
    if (!editing) return;
    setPendingAction("delete");
  }

  async function handleSave() {
    const trimDesc = description.trim();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    const isoDate = brToISO(date)!;
    setPendingAction(null);
    setLoading(true);
    try {
      const res = await fetch(
        isEdit ? `/api/transactions/${editing!.id}` : "/api/transactions",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: trimDesc.trim(), amount: parsedAmount, type, category, date: isoDate }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao salvar.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      onClose();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setPendingAction(null);
    setLoading(true);
    try {
      await fetch(`/api/transactions/${editing.id}`, { method: "DELETE" });
      queryClient.invalidateQueries();
      onClose();
    } catch {
      setError("Erro ao excluir.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  if (pendingAction) {
    const isDelete = pendingAction === "delete";
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPendingAction(null)}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="glass-strong rounded-2xl p-6 w-full max-w-sm relative z-10 fadeUp" onClick={(e) => e.stopPropagation()}>
          <div className="text-center mb-5">
            <p className="text-[15px] font-semibold text-white mb-2">
              {isDelete ? "Excluir transação?" : "Salvar alterações?"}
            </p>
            <p className="text-[13px] text-[var(--muted)] leading-relaxed">
              {isDelete
                ? `Você está excluindo 1 transação. Tem certeza que deseja continuar? Esta ação é irreversível.`
                : `Você está editando 1 transação. Tem certeza que deseja continuar?`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPendingAction(null)}
              className="flex-1 h-10 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[13px] font-medium hover:text-white hover:border-white/20 transition-colors">
              Cancelar
            </button>
            <button
              onClick={isDelete ? handleDelete : handleSave}
              disabled={loading}
              className={`flex-1 h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${
                isDelete
                  ? "bg-[rgba(244,63,94,0.12)] border border-[rgba(244,63,94,0.4)] text-[var(--expense)] hover:bg-[rgba(244,63,94,0.2)]"
                  : "btn-primary"
              }`}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : isDelete ? "Sim, excluir" : "Sim, salvar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="glass-strong rounded-2xl p-6 w-full max-w-md relative z-10 fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[15px] font-semibold text-white">
              {isEdit ? "Editar transação" : "Nova transação"}
            </div>
            {isEdit && editing?.sourceFileName && (
              <div className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {editing.sourceFileName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-1 p-0.5 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-[13px] font-semibold rounded-[10px] transition-colors ${
                  type === t
                    ? t === "expense"
                      ? "bg-[var(--expense-soft)] text-[var(--expense)]"
                      : "bg-[var(--income-soft)] text-[var(--income)]"
                    : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {t === "expense" ? "Saída" : "Entrada"}
              </button>
            ))}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-[0.14em] mb-1.5">Descrição</label>
            <input
              className="field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Compra de estoque, Pagamento cliente…"
              onKeyDown={(e) => e.key === "Enter" && requestSave()}
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-[0.14em] mb-1.5">Valor (R$)</label>
              <input
                className="field"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-[0.14em] mb-1.5">Data</label>
              <input
                className="field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="dd/mm/aaaa"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Category chips */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--muted)] uppercase tracking-[0.14em] mb-2">Categoria</label>

            {/* Existing + session-added chips */}
            <div className="flex flex-wrap gap-1.5">
              {allChips.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`chip ${category === cat ? "chip-on" : ""}`}
                >
                  {cat}
                </button>
              ))}

              {/* '+' chip / inline input */}
              {addingCustom ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={customInputRef}
                    className="field h-[30px] px-2 py-0 text-[12px] w-36 rounded-full"
                    placeholder="Nova categoria…"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); confirmCustom(); }
                      if (e.key === "Escape") { setAddingCustom(false); setCustomInput(""); }
                    }}
                  />
                  <button
                    type="button"
                    onClick={confirmCustom}
                    className="w-[30px] h-[30px] grid place-items-center rounded-full bg-[var(--accent)] text-[#09090b] shrink-0"
                  >
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCustom(true)}
                  className="chip flex items-center gap-1"
                  title="Adicionar categoria"
                >
                  <Plus size={11} />
                </button>
              )}
            </div>

            {/* Segment suggestions */}
            {visibleSuggestions.length > 0 && (
              <div className="mt-2.5">
                <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.12em] mb-1.5">Sugestões para seu segmento</div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleSuggestions.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSessionCats((prev) => [...prev, cat]); setCategory(cat); }}
                      className={`chip border-dashed ${category === cat ? "chip-on" : ""}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[12px] text-[var(--expense)]">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isEdit && (
              <button
                onClick={requestDelete}
                disabled={loading}
                className="w-10 h-10 grid place-items-center rounded-xl border border-[rgba(244,63,94,0.3)] text-[var(--expense)] hover:bg-[rgba(244,63,94,0.08)] transition-colors shrink-0 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={requestSave}
              disabled={loading}
              className="btn-primary flex-1 h-10 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : isEdit ? "Salvar alterações" : "Adicionar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
