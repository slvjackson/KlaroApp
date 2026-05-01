import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useGetUpload, getGetUploadQueryKey, useUpdateParsedRecord, useDeleteParsedRecord, useConfirmParsedRecords, useDeleteUpload, ParsedRecord } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, CheckSquare, Square, Loader2, Search, X, Plus } from "lucide-react";

function isoToBR(iso: string | null | undefined) {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return "";
  return `${day}/${m}/${y}`;
}

function brToISO(br: string) {
  const [day, month, year] = br.split('/');
  if (!day || !month || !year || year.length < 4) return null;
  const d = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function Review() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { id } = useParams();
  const uploadId = id ? parseInt(id, 10) : 0;
  const [, setLocation] = useLocation();

  const queryClient = useQueryClient();
  const { data: upload, isLoading } = useGetUpload(uploadId, {
    query: { enabled: !!uploadId, queryKey: getGetUploadQueryKey(uploadId) }
  });

  const updateRecord = useUpdateParsedRecord();
  const deleteRecord = useDeleteParsedRecord();
  const confirmRecords = useConfirmParsedRecords();
  const deleteUpload = useDeleteUpload();
  const [discarding, setDiscarding] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  // Per-row local edits
  const [edits, setEdits] = useState<Record<number, Record<string, any>>>({});

  // Text filter for rows
  const [rowFilter, setRowFilter] = useState("");

  // Categories for bulk panel
  const [existingCats, setExistingCats] = useState<string[]>([]);
  const [suggestedCats, setSuggestedCats] = useState<string[]>([]);
  const [addingCustomCat, setAddingCustomCat] = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");
  const [sessionCats, setSessionCats] = useState<string[]>([]);
  const customCatRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/transactions/categories")
      .then((r) => r.json())
      .then((d) => { setExistingCats(d.existing ?? []); setSuggestedCats(d.suggestions ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (addingCustomCat) customCatRef.current?.focus();
  }, [addingCustomCat]);

  // Bulk selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkType, setBulkType] = useState<"" | "income" | "expense">("");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);

  // Filtered rows (client-side)
  const filteredRecords = useMemo(() => {
    const q = rowFilter.trim().toLowerCase();
    if (!q) return upload?.parsedRecords ?? [];
    return (upload?.parsedRecords ?? []).filter((r) =>
      r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
    );
  }, [upload?.parsedRecords, rowFilter]);

  const filteredIds = useMemo(() => filteredRecords.map((r) => r.id), [filteredRecords]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  // Category chips for bulk panel
  const allCatChips = useMemo(() => [...existingCats, ...sessionCats], [existingCats, sessionCats]);

  const visibleSuggestions = useMemo(() => {
    const seen = new Set(allCatChips.map((c) => c.toLowerCase()));
    return suggestedCats.filter((c) => !seen.has(c.toLowerCase()));
  }, [allCatChips, suggestedCats]);

  function confirmCustomCat() {
    const val = customCatInput.trim();
    setAddingCustomCat(false);
    setCustomCatInput("");
    if (!val) return;
    const lower = val.toLowerCase();
    if (![...existingCats, ...sessionCats].some((c) => c.toLowerCase() === lower)) {
      setSessionCats((prev) => [...prev, val]);
    }
    setBulkCategory(val);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); filteredIds.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredIds]));
    }
  }

  function toggleRow(id: number) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleBulkApply() {
    if (selected.size === 0) return;
    if (!bulkCategory && !bulkType && !bulkDate.trim()) return;
    const isoDate = bulkDate.trim() ? brToISO(bulkDate.trim()) : null;
    setBulkApplying(true);
    try {
      await fetch("/api/parsed-records/bulk-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          ...(bulkCategory && { category: bulkCategory }),
          ...(bulkType && { type: bulkType }),
          ...(isoDate && { date: isoDate }),
        }),
      });
      queryClient.setQueryData(getGetUploadQueryKey(uploadId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          parsedRecords: old.parsedRecords.map((r: ParsedRecord) =>
            selected.has(r.id)
              ? {
                  ...r,
                  ...(bulkCategory && { category: bulkCategory }),
                  ...(bulkType && { type: bulkType }),
                  ...(isoDate && { date: isoDate }),
                }
              : r
          ),
        };
      });
      setSelected(new Set());
      setBulkCategory("");
      setBulkType("");
      setBulkDate("");
    } finally {
      setBulkApplying(false);
    }
  }

  const setField = useCallback((recordId: number, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [recordId]: { ...prev[recordId], [field]: value } }));
  }, []);

  const getField = (record: ParsedRecord, field: keyof ParsedRecord) =>
    edits[record.id]?.[field] !== undefined ? edits[record.id][field] : record[field];

  const handleUpdate = (recordId: number, field: string, value: any) => {
    updateRecord.mutate(
      { id: recordId, data: { [field]: value } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetUploadQueryKey(uploadId), (old: any) => {
            if (!old) return old;
            return { ...old, parsedRecords: old.parsedRecords.map((r: ParsedRecord) => r.id === recordId ? { ...r, ...updated } : r) };
          });
        },
        onError: (err) => {
          console.error("[review] PATCH failed for record", recordId, field, err);
        },
      }
    );
  };

  const handleDelete = (recordId: number) => {
    deleteRecord.mutate({ id: recordId }, {
      onSuccess: () => {
        setSelected((prev) => { const next = new Set(prev); next.delete(recordId); return next; });
        queryClient.setQueryData(getGetUploadQueryKey(uploadId), (old: any) => {
          if (!old) return old;
          return { ...old, parsedRecords: old.parsedRecords.filter((r: ParsedRecord) => r.id !== recordId) };
        });
      }
    });
  };

  const [confirmFlushing, setConfirmFlushing] = useState(false);

  const handleConfirm = async () => {
    // Flush all locally-edited fields to the DB before confirming to avoid
    // the race condition where onBlur + onClick fire simultaneously and the
    // PATCH hasn't landed before the confirm request reads from the DB.
    const pendingIds = Object.keys(edits).map(Number).filter(id => {
      const fields = edits[id];
      return fields && Object.keys(fields).length > 0;
    });

    if (pendingIds.length > 0) {
      setConfirmFlushing(true);
      await Promise.all(
        pendingIds.map(async (recordId) => {
          const fieldEdits = edits[recordId];
          if (!fieldEdits) return;
          const data: Record<string, any> = {};
          for (const [field, value] of Object.entries(fieldEdits)) {
            if (field === "date") {
              const iso = typeof value === "string" ? brToISO(value) : value;
              if (iso) data.date = iso;
            } else {
              data[field] = value;
            }
          }
          if (Object.keys(data).length === 0) return;
          try {
            await updateRecord.mutateAsync({ id: recordId, data });
          } catch {
            // best-effort — proceed even if individual saves fail
          }
        })
      );
      setConfirmFlushing(false);
    }

    confirmRecords.mutate({ data: { rawInputId: uploadId } }, { onSuccess: () => setLocation("/transactions") });
  };

  const canApply = someSelected && (!!bulkCategory || !!bulkType || !!bulkDate.trim());

  async function handleDiscard() {
    setDiscarding(true);
    try {
      await deleteUpload.mutateAsync({ id: uploadId });
      setLocation("/upload");
    } finally {
      setDiscarding(false);
      setShowDiscard(false);
    }
  }

  if (isAuthLoading) return null;

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Revisar Dados</h1>
            <p className="text-muted-foreground">
              {isLoading ? <Skeleton className="h-4 w-48" /> : `Arquivo: ${upload?.fileName}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiscard(true)}
              disabled={discarding}
              className="h-9 px-4 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[13px] font-medium hover:text-white hover:border-white/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <X size={13} />
              Descartar
            </button>
            <Button
              onClick={handleConfirm}
              disabled={!upload?.parsedRecords?.length || confirmRecords.isPending || confirmFlushing}
              className="font-bold gap-2"
            >
              <Check className="w-4 h-4" />
              Confirmar Registros
            </Button>
          </div>
        </div>

        {/* Row filter */}
        {!isLoading && (upload?.parsedRecords?.length ?? 0) > 0 && (
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <input
                value={rowFilter}
                onChange={(e) => setRowFilter(e.target.value)}
                placeholder="Filtrar por descrição ou categoria…"
                className="field py-2 text-[12px] w-full"
                style={{ paddingLeft: "2.25rem", paddingRight: "2rem" }}
              />
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              {rowFilter && (
                <button onClick={() => setRowFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            {rowFilter && (
              <span className="text-[12px] text-[var(--muted)]">
                {filteredRecords.length} resultado{filteredRecords.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Bulk action panel */}
        {someSelected && (
          <div className="glass-strong rounded-2xl p-4 space-y-3 border border-[var(--accent)]/20">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-white">
                {selected.size} linha{selected.size > 1 ? "s" : ""} selecionada{selected.size > 1 ? "s" : ""}
              </span>
              <button onClick={() => setSelected(new Set())} className="text-[11px] text-[var(--muted)] hover:text-white">
                Limpar seleção
              </button>
            </div>

            {/* Category chips */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.12em]">Categoria</p>
              <div className="flex flex-wrap gap-1.5">
                {allCatChips.map((cat) => (
                  <button key={cat} type="button" onClick={() => setBulkCategory(bulkCategory === cat ? "" : cat)}
                    className={`chip ${bulkCategory === cat ? "chip-on" : ""}`}>
                    {cat}
                  </button>
                ))}
                {addingCustomCat ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={customCatRef}
                      className="field h-[30px] px-2 py-0 text-[12px] w-36 rounded-full"
                      placeholder="Nova categoria…"
                      value={customCatInput}
                      onChange={(e) => setCustomCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); confirmCustomCat(); }
                        if (e.key === "Escape") { setAddingCustomCat(false); setCustomCatInput(""); }
                      }}
                    />
                    <button type="button" onClick={confirmCustomCat}
                      className="w-[30px] h-[30px] grid place-items-center rounded-full bg-[var(--accent)] text-[#09090b] shrink-0">
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingCustomCat(true)}
                    className="chip flex items-center gap-1" title="Adicionar categoria">
                    <Plus size={11} />
                  </button>
                )}
              </div>
              {visibleSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-[var(--muted)] self-center">Sugestões:</span>
                  {visibleSuggestions.map((cat) => (
                    <button key={cat} type="button"
                      onClick={() => { setSessionCats((p) => [...p, cat]); setBulkCategory(cat); }}
                      className={`chip border-dashed ${bulkCategory === cat ? "chip-on" : ""}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type + Date + Apply */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type toggle */}
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
                {([["", "Manter"], ["income", "Entrada"], ["expense", "Saída"]] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setBulkType(val as any)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-[7px] transition-colors ${
                      bulkType === val
                        ? val === "income" ? "bg-[var(--income-soft)] text-[var(--income)]"
                          : val === "expense" ? "bg-[var(--expense-soft)] text-[var(--expense)]"
                          : "bg-white/10 text-white"
                        : "text-[var(--muted)] hover:text-white"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Date */}
              <div className="relative">
                <input
                  className="field h-9 px-3 py-0 text-[12px] rounded-lg w-[130px]"
                  placeholder="dd/mm/aaaa"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <button
                onClick={handleBulkApply}
                disabled={bulkApplying || !canApply}
                className="btn-primary h-9 px-5 rounded-xl text-[12.5px] font-semibold flex items-center gap-2 disabled:opacity-50 ml-auto"
              >
                {bulkApplying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aplicar em {selected.size}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10 px-3">
                    <button onClick={toggleAll} className="text-[var(--muted)] hover:text-white transition-colors">
                      {allSelected
                        ? <CheckSquare size={15} className="text-[var(--accent)]" />
                        : someSelected && filteredIds.some((id) => selected.has(id))
                        ? <CheckSquare size={15} className="text-[var(--muted)]" />
                        : <Square size={15} />}
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[120px]">Valor (R$)</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead className="w-[150px]">Categoria</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const isChecked = selected.has(record.id);
                  return (
                    <TableRow key={record.id}
                      className={`border-border hover:bg-muted/50 transition-colors ${isChecked ? "bg-[var(--accent-soft)]/20" : ""}`}>
                      <TableCell className="px-3 py-2">
                        <button onClick={() => toggleRow(record.id)} className="text-[var(--muted)] hover:text-white transition-colors">
                          {isChecked
                            ? <CheckSquare size={15} className="text-[var(--accent)]" />
                            : <Square size={15} />}
                        </button>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="text"
                          placeholder="dd/mm/aaaa"
                          value={edits[record.id]?.date ?? isoToBR(record.date)}
                          onChange={(e) => setField(record.id, 'date', e.target.value)}
                          onBlur={(e) => { const iso = brToISO(e.target.value); if (iso) handleUpdate(record.id, 'date', iso); }}
                          className="bg-transparent border-transparent hover:border-input focus:border-ring h-8 px-2 w-[104px]"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          value={getField(record, 'description') as string}
                          onChange={(e) => setField(record.id, 'description', e.target.value)}
                          onBlur={(e) => handleUpdate(record.id, 'description', e.target.value)}
                          className="bg-transparent border-transparent hover:border-input focus:border-ring h-8 px-2"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          type="number" step="0.01"
                          value={getField(record, 'amount') as number}
                          onChange={(e) => setField(record.id, 'amount', e.target.value)}
                          onBlur={(e) => handleUpdate(record.id, 'amount', parseFloat(e.target.value))}
                          className="bg-transparent border-transparent hover:border-input focus:border-ring h-8 px-2"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Select
                          value={getField(record, 'type') as string}
                          onValueChange={(val) => {
                            setField(record.id, 'type', val);
                            handleUpdate(record.id, 'type', val);
                          }}
                        >
                          <SelectTrigger className="h-8 bg-transparent border-transparent hover:border-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">Entrada</SelectItem>
                            <SelectItem value="expense">Saída</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-2">
                        <Input
                          value={getField(record, 'category') as string}
                          onChange={(e) => setField(record.id, 'category', e.target.value)}
                          onBlur={(e) => handleUpdate(record.id, 'category', e.target.value)}
                          className="bg-transparent border-transparent hover:border-input focus:border-ring h-8 px-2"
                        />
                      </TableCell>
                      <TableCell className="p-2 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}
                          className="text-muted-foreground hover:text-destructive h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRecords.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <p className="text-white font-medium">
                        {rowFilter ? "Nenhum registro para este filtro." : "Nenhum registro encontrado neste arquivo"}
                      </p>
                      {!rowFilter && (
                        <p className="text-muted-foreground text-sm max-w-md mx-auto mt-1">
                          Verifique se o arquivo tem colunas de data, descrição e valor. Formatos suportados: CSV, Excel (.xlsx/.xls).
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Discard confirmation modal */}
      {showDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDiscard(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="glass-strong rounded-2xl p-6 w-full max-w-sm relative z-10 fadeUp" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[var(--expense-soft)] border border-[rgba(244,63,94,0.25)] grid place-items-center mx-auto mb-3">
                <Trash2 size={20} className="text-[var(--expense)]" />
              </div>
              <p className="text-[15px] font-semibold text-white mb-2">Descartar upload?</p>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                O arquivo e todos os registros extraídos serão excluídos permanentemente. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscard(false)}
                className="flex-1 h-10 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[13px] font-medium hover:text-white hover:border-white/20 transition-colors"
              >
                Manter
              </button>
              <button
                onClick={handleDiscard}
                disabled={discarding}
                className="flex-1 h-10 rounded-xl bg-[var(--expense)] text-white text-[13px] font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {discarding ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
