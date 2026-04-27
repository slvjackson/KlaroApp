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
import { Trash2, Plus, Check } from "lucide-react";

function isoToBR(iso: string) {
  const d = iso.split('T')[0];
  const [y, m, day] = d.split('-');
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

  // Local editable overrides — updated on every keystroke, sent to server only on blur
  const [edits, setEdits] = useState<Record<number, Record<string, any>>>({});

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
      {
        onSuccess: () => {
          setLocation("/transactions");
        }
      }
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
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[120px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[120px]">Valor (R$)</TableHead>
                  <TableHead className="w-[120px]">Tipo</TableHead>
                  <TableHead className="w-[150px]">Categoria</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upload?.parsedRecords?.map((record) => (
                  <TableRow key={record.id} className="border-border hover:bg-muted/50 transition-colors">
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
                ))}
                {(!upload?.parsedRecords || upload.parsedRecords.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
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
