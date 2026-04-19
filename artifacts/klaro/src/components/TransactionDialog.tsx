import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { getListTransactionsQueryKey } from "@workspace/api-client-react";

const EXPENSE_CATEGORIES = [
  "Alimentação", "Moradia", "Transporte", "Saúde",
  "Lazer", "Educação", "Vestuário", "Serviços", "Outros",
];
const INCOME_CATEGORIES = ["Renda", "Freelance", "Investimentos", "Outros"];

export interface TransactionData {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

interface Props {
  open: boolean;
  editing: TransactionData | null;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export function TransactionDialog({ open, editing, onClose }: Props) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = editing !== null;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setType(editing.type);
      setCategory(editing.category);
      setDate(editing.date);
    } else {
      setDescription("");
      setAmount("");
      setType("expense");
      setCategory("");
      setDate(todayISO());
    }
    setError("");
  }, [open, editing]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory("");
  }, [type]);

  async function handleSave() {
    const trimDesc = description.trim();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!trimDesc) { setError("Informe uma descrição."); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError("Valor inválido."); return; }
    if (!category) { setError("Selecione uma categoria."); return; }
    if (!date) { setError("Informe a data."); return; }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(isEdit ? `/api/transactions/${editing!.id}` : "/api/transactions", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimDesc, amount: parsedAmount, type, category, date }),
      });
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
    if (!editing || !confirm("Excluir esta transação?")) return;
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? "Editar transação" : "Nova transação"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type toggle */}
          <div className="flex gap-1 p-1 bg-secondary" style={{ borderRadius: "8px" }}>
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  type === t
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ borderRadius: "6px" }}
              >
                {t === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Salário..."
              className="bg-background border-border text-white"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Valor (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              className="bg-background border-border text-white"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-background border-border text-white"
            />
          </div>

          {/* Category chips */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Categoria</Label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium border transition-colors rounded-full ${
                    category === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isEdit && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleDelete}
                disabled={loading}
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Adicionar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
