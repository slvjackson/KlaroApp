import { useCallback, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useUploadFile, useListUploads } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { UploadCloud, Loader2, FileImage, FileSpreadsheet, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const SUPPORTED = [
  { icon: FileText, label: "PDF" },
  { icon: FileSpreadsheet, label: "Excel / CSV / OFX" },
  { icon: FileImage, label: "Imagem" },
];

export default function Upload() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const [, setLocation] = useLocation();
  const uploadFile = useUploadFile();
  const { data: existingUploads } = useListUploads();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duplicate confirmation state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateUpload, setDuplicateUpload] = useState<{ fileName: string; createdAt: string } | null>(null);

  function doUpload(file: File) {
    setError(null);
    uploadFile.mutate(
      { data: { file } },
      {
        onSuccess: (data) => setLocation(`/review/${data.id}`),
        onError: (err: any) => setError(err.message || "Erro ao fazer upload do arquivo"),
      }
    );
  }

  const handleFile = (file: File) => {
    // Check for duplicate filename among existing uploads
    const existing = (existingUploads ?? []) as { fileName: string; createdAt: string }[];
    const duplicate = existing.find((u) => u.fileName === file.name);
    if (duplicate) {
      setPendingFile(file);
      setDuplicateUpload(duplicate);
      return;
    }
    doUpload(file);
  };

  function confirmDuplicate() {
    if (pendingFile) doUpload(pendingFile);
    setPendingFile(null);
    setDuplicateUpload(null);
  }

  function cancelDuplicate() {
    setPendingFile(null);
    setDuplicateUpload(null);
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [existingUploads]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
    e.target.value = "";
  };

  if (isAuthLoading) return null;

  return (
    <Layout title="Upload">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Upload de Dados</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">
            Envie extratos bancários, planilhas ou fotos de anotações. A IA fará a leitura e organização automaticamente.
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={`glass rounded-2xl transition-all ${isDragging ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(106,248,47,0.15)]" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div
            className={`border-2 border-dashed rounded-2xl p-14 text-center flex flex-col items-center gap-5 transition-colors ${
              isDragging
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border-2)] hover:border-[var(--border)]"
            }`}
          >
            {uploadFile.isPending ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] grid place-items-center">
                  <Loader2 size={28} className="text-[#90f048] animate-spin" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">Processando arquivo…</div>
                  <p className="text-[12.5px] text-[var(--muted)] mt-1">A IA está extraindo os dados — pode levar alguns segundos.</p>
                </div>
              </>
            ) : (
              <>
                <div className={`w-16 h-16 rounded-2xl grid place-items-center transition-colors ${isDragging ? "bg-[var(--accent-soft)]" : "bg-white/5"}`}>
                  <UploadCloud size={28} className={isDragging ? "text-[#90f048]" : "text-[var(--muted)]"} />
                </div>

                <div>
                  <div className="text-[15px] font-semibold text-white">
                    {isDragging ? "Solte o arquivo aqui" : "Arraste um arquivo ou clique para selecionar"}
                  </div>
                  <p className="text-[12.5px] text-[var(--muted)] mt-1">Suporta CSV, Excel, PDF, OFX (extrato bancário) e imagens</p>
                </div>

                <label className="cursor-pointer">
                  <div className="btn-primary px-6 py-2.5 rounded-xl text-[13px] font-semibold inline-block">
                    Selecionar arquivo
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv,.xlsx,.xls,.pdf,.ofx,.qfx,.qbo,image/*"
                    onChange={onFileInput}
                  />
                </label>

                {error && (
                  <p className="text-[12.5px] text-[var(--expense)]">{error}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Supported formats */}
        <div className="grid grid-cols-3 gap-3">
          {SUPPORTED.map(({ icon: Icon, label }) => (
            <div key={label} className="glass rounded-xl p-4 flex flex-col items-center gap-2 text-center">
              <div className="w-9 h-9 rounded-lg bg-white/5 grid place-items-center">
                <Icon size={16} className="text-[var(--muted)]" />
              </div>
              <div className="text-[12px] font-medium text-white">{label}</div>
            </div>
          ))}
        </div>

        {/* Info card */}
        <div className="glass rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] grid place-items-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#90f048" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white">Extração com IA</div>
            <p className="text-[12px] text-[var(--muted)] leading-relaxed mt-0.5">
              Nossa IA lê automaticamente valores, datas e categorias. Você revisa e confirma antes de salvar.
            </p>
          </div>
        </div>
      </div>

      {/* Duplicate file confirmation modal */}
      {duplicateUpload && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={cancelDuplicate}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="glass-strong rounded-2xl p-6 w-full max-w-sm relative z-10 fadeUp" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[rgba(251,146,60,0.12)] border border-[rgba(251,146,60,0.25)] grid place-items-center mx-auto mb-3">
                <AlertTriangle size={20} className="text-[#fb923c]" />
              </div>
              <p className="text-[15px] font-semibold text-white mb-2">Arquivo já enviado</p>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">
                O arquivo <span className="text-white font-medium">"{pendingFile.name}"</span> já foi enviado anteriormente
                {duplicateUpload.createdAt
                  ? ` em ${format(new Date(duplicateUpload.createdAt), "dd/MM/yyyy")}`
                  : ""
                }.
                Deseja enviar novamente mesmo assim?
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelDuplicate}
                className="flex-1 h-10 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[13px] font-medium hover:text-white hover:border-white/20 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDuplicate}
                className="flex-1 h-10 rounded-xl btn-primary text-[13px] font-semibold">
                Enviar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
