import { useState, useCallback } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useGetUpload, getGetUploadQueryKey, useUpdateParsedRecord, useDeleteParsedRecord, useConfirmParsedRecords, ParsedRecord } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, CheckSquare, Square, Loader2 } from "lucide-react";

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

  // Per-row local edits
  const [edits, setEdits] = useState<Record<number, Record<string, any>>>({});

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkType, setBulkType] = useState<"" | "income" | "expense">("");
  const [bulkApplying, setBulkApplying] = useState(false);

  const allIds = upload?.parsedRecords?.map((r) => r.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkApply() {
    if (selected.size === 0) return;
    if (!bulkCategory.trim() && !bulkType) return;
    setBulkApplying(true);
    try {
      await fetch("/api/parsed-records/bulk-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          ...(bulkCategory.trim() && { category: bulkCategory.trim() }),
          ...(bulkType && { type: bulkType }),
        }),
      });
      // Optimistically update query cache
      queryClient.setQueryData(getGetUploadQueryKey(uploadId), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          parsedRecords: old.parsedRecords.map((r: ParsedRecord) =>
            selected.has(r.id)
              ? {
                  ...r,
                  ...(bulkCategory.trim() && { category: bulkCategory.trim() }),
                  ...(bulkType && { type: bulkType }),
                }
              : r
          ),
        };
      });
      setSelected(new Set());
      setBulkCategory("");
      setBulkType("");
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
            return {
              ...old,
              parsedRecords: old.parsedRecords.map((r: ParsedRecord) => r.id === recordId ? { ...r, ...updated } : r)
            };
          });
        }
      }
    );
  };

  const handleDelete = (recordId: number) => {
    deleteRecord.mutate(
      { id: recordId },
      {
        onSuccess: () => {
          setSelected((prev) => { const next = new Set(prev); next.delete(recordId); return next; });
          queryClient.setQueryData(getGetUploadQueryKey(uploadId), (old: any) => {
            if (!old) return old;
            return {
              ...old,
              parsedRecords: old.parsedRecords.filter((r: ParsedRecord) => r.id !== recordId)
            };
          });
        }
      }
    );
  };

  const handleConfirm = () => {
    confirmRecords.mutate(
      { data: { rawInputId: uploadId } },
      { onSuccess: () => setLocation("/transactions") }
    );
  };

  if (isAuthLoading) return null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Revisar Dados</h1>
            <p className="text-muted-foreground">
              {isLoading ? <Skeleton className="h-4 w-48" /> : `Arquivo: ${upload?.fileName}`}
            </p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!upload?.parsedRecords?.length || confirmRecords.isPending}
            className="font-bold gap-2"
          >
            <Check className="w-4 h-4" />
            Confirmar Registros
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            {/* Bulk action bar */}
            {someSelected && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--accent-soft)] border-b border-[var(--border)]">
                <span className="text-[12px] font-semibold text-white shrink-0">
                  {selected.size} selecionado{selected.size > 1 ? "s" : ""}
                </span>
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <input
                    className="field h-8 px-2 py-0 text-[12px] w-44 rounded-lg"
                    placeholder="Nova categoria…"
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBulkApply()}
                  />
                  <select
                    className="field h-8 px-2 py-0 text-[12px] rounded-lg"
                    value={bulkType}
                    onChange={(e) => setBulkType(e.target.value as any)}
                  >
                    <option value="">Tipo (manter)</option>
                    <option value="income">Entrada</option>
                    <option value="expense">Saída</option>
                  </select>
                  <button
                    onClick={handleBulkApply}
                    disabled={bulkApplying || (!bulkCategory.trim() && !bulkType)}
                    className="btn-primary h-8 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {bulkApplying ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Aplicar
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-[11px] text-[var(--muted)] hover:text-white ml-1"
                  >
                    Limpar seleção
                  </button>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10 px-3">
                    <button onClick={toggleAll} className="text-[var(--muted)] hover:text-white transition-colors">
                      {allSelected ? <CheckSquare size={15} className="text-[var(--accent)]" /> : <Square size={15} />}
                    </button>
                  </TableHead>
                  <TableHead className="w-[120px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[120px]">Valor (R$)</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead className="w-[150px]">Categoria</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upload?.parsedRecords?.map((record) => {
                  const isChecked = selected.has(record.id);
                  return (
                    <TableRow
                      key={record.id}
                      className={`border-border hover:bg-muted/50 transition-colors ${isChecked ? "bg-[var(--accent-soft)]/30" : ""}`}
                    >
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
                          onBlur={(e) => {
                            const iso = brToISO(e.target.value);
                            if (iso) handleUpdate(record.id, 'date', iso);
                          }}
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
                          type="number"
                          step="0.01"
                          value={getField(record, 'amount') as number}
                          onChange={(e) => setField(record.id, 'amount', e.target.value)}
                          onBlur={(e) => handleUpdate(record.id, 'amount', parseFloat(e.target.value))}
                          className="bg-transparent border-transparent hover:border-input focus:border-ring h-8 px-2"
                        />
                      </TableCell>
                      <TableCell className="p-2">
                        <Select
                          value={record.type}
                          onValueChange={(val) => handleUpdate(record.id, 'type', val)}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!upload?.parsedRecords || upload.parsedRecords.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <div className="space-y-2">
                        <p className="text-white font-medium">Nenhum registro encontrado neste arquivo</p>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          O sistema não conseguiu identificar colunas de data, descrição e valor no arquivo.
                          Verifique se o arquivo tem uma linha de cabeçalho com esses campos e tente novamente.
                          Formatos suportados: CSV, Excel (.xlsx/.xls).
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
