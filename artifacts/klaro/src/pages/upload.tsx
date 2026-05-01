import { useCallback, useEffect, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useListUploads } from "@workspace/api-client-react";
import { useUploadContext } from "@/contexts/upload-context";
import { UploadCloud, Loader2, FileImage, FileSpreadsheet, FileText, AlertTriangle, Sparkles, Brain, CheckCircle2, X } from "lucide-react";
import { format } from "date-fns";

// ─── Phases ────────────────────────────────────────────────────────────────────

const UPLOAD_PHASES = [
  { after: 0,  icon: UploadCloud,   title: "Enviando arquivo…",      sub: "Aguardando confirmação do servidor." },
  { after: 4,  icon: Brain,         title: "Analisando com IA…",     sub: "A IA está lendo e identificando as transações." },
  { after: 15, icon: Sparkles,      title: "Extraindo transações…",  sub: "Arquivos grandes podem levar alguns instantes." },
  { after: 35, icon: Sparkles,      title: "Quase lá…",              sub: "Finalizando a extração. Obrigado pela paciência!" },
  { after: 60, icon: CheckCircle2,  title: "Ainda processando…",     sub: "Documento extenso. Continue aguardando." },
];

// ─── Overlay (also exported for App.tsx to render globally) ────────────────────

export function GlobalUploadOverlay({
  fileName,
  onCancel,
}: {
  fileName: string;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [fileName]);

  const phase = UPLOAD_PHASES.reduce(
    (cur, p) => (elapsed >= p.after ? p : cur),
    UPLOAD_PHASES[0],
  );
  const phaseIndex = UPLOAD_PHASES.reduce(
    (idx, p, i) => (elapsed >= p.after ? i : idx),
    0,
  );
  const PhaseIcon = phase.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div className="glass-strong rounded-2xl p-8 w-full max-w-md relative z-10 fadeUp flex flex-col items-center text-center gap-6">
        {/* Animated icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-[var(--accent-soft)] grid place-items-center">
            <PhaseIcon
              size={36}
              className="text-[#90f048] transition-all duration-500"
              style={{ animation: "pulse 2s ease-in-out infinite" }}
            />
          </div>
          <div
            className="absolute -inset-2 rounded-[28px] border border-[var(--accent)]/25"
            style={{ animation: "spin 4s linear infinite" }}
          />
          <div
            className="absolute -inset-4 rounded-[36px] border border-[var(--accent)]/10"
            style={{ animation: "spin 7s linear infinite reverse" }}
          />
        </div>

        {/* Text */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[17px] font-semibold text-white transition-all duration-500">
            {phase.title}
          </p>
          {fileName && (
            <p
              className="text-[12px] font-medium text-[var(--muted)] max-w-xs truncate mx-auto"
              title={fileName}
            >
              {fileName}
            </p>
          )}
          <p className="text-[13px] text-[var(--muted)] leading-relaxed mt-1 transition-all duration-500">
            {phase.sub}
          </p>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {UPLOAD_PHASES.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-700"
              style={{
                width: i === phaseIndex ? 24 : 8,
                background:
                  i < phaseIndex
                    ? "var(--accent)"
                    : i === phaseIndex
                      ? "linear-gradient(90deg, #6af82f, #4de020)"
                      : "rgba(255,255,255,0.1)",
                boxShadow:
                  i === phaseIndex ? "0 0 8px rgba(106,248,47,0.6)" : "none",
              }}
            />
          ))}
        </div>

        {/* Spinner + elapsed */}
        <div className="flex items-center gap-3 text-[var(--muted)]">
          <Loader2 size={14} className="animate-spin shrink-0 opacity-60" />
          {elapsed >= 4 && (
            <span className="text-[11px] opacity-50 tabular-nums">{elapsed}s</span>
          )}
        </div>

        {/* Cancel */}
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-white transition-colors border border-[var(--border)] rounded-xl px-4 py-2"
        >
          <X size={12} />
          Cancelar upload
        </button>
      </div>
    </div>
  );
}

// ─── Supported formats ─────────────────────────────────────────────────────────

const SUPPORTED = [
  { icon: FileText, label: "PDF" },
  { icon: FileSpreadsheet, label: "Excel / CSV / OFX" },
  { icon: FileImage, label: "Imagem" },
];

// ─── Upload page ───────────────────────────────────────────────────────────────

export default function Upload() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: existingUploads } = useListUploads();
  const { uploading, uploadError, startUpload, dismissError } = useUploadContext();
  const [isDragging, setIsDragging] = useState(false);

  // Duplicate confirmation state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateUpload, setDuplicateUpload] = useState<{ fileName: string; createdAt: string } | null>(null);

  function doUpload(file: File) {
    dismissError();
    startUpload(file);
  }

  const handleFile = (file: File) => {
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
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    },
    [existingUploads],
  );

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
            <div className={`w-16 h-16 rounded-2xl grid place-items-center transition-colors ${isDragging ? "bg-[var(--accent-soft)]" : "bg-white/5"}`}>
              <UploadCloud size={28} className={isDragging ? "text-[#90f048]" : "text-[var(--muted)]"} />
            </div>

            <div>
              <div className="text-[15px] font-semibold text-white">
                {isDragging ? "Solte o arquivo aqui" : "Arraste um arquivo ou clique para selecionar"}
              </div>
              <p className="text-[12.5px] text-[var(--muted)] mt-1">Suporta CSV, Excel, PDF, OFX (extrato bancário) e imagens</p>
            </div>

            <label className={`cursor-pointer ${uploading ? "pointer-events-none opacity-50" : ""}`}>
              <div className="btn-primary px-6 py-2.5 rounded-xl text-[13px] font-semibold inline-block">
                Selecionar arquivo
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls,.pdf,.ofx,.qfx,.qbo,image/*"
                onChange={onFileInput}
                disabled={uploading}
              />
            </label>

            {uploadError && (
              <p className="text-[12.5px] text-[var(--expense)]">{uploadError}</p>
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
