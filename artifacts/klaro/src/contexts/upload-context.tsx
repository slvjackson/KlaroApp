import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

interface UploadContextValue {
  uploading: boolean;
  uploadingFileName: string;
  uploadError: string;
  startUpload: (file: File) => void;
  cancel: () => void;
  dismissError: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function useUploadContext() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadContext must be inside UploadProvider");
  return ctx;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const startUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setUploadingFileName(file.name);
      setUploadError("");

      const controller = new AbortController();
      controllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
          signal: controller.signal,
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadError(data.error ?? "Erro ao fazer upload do arquivo");
          return;
        }

        const data = await res.json();
        setLocation(`/review/${data.id}`);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // user-cancelled — no error shown
        } else {
          setUploadError(
            err instanceof Error ? err.message : "Erro ao enviar arquivo",
          );
        }
      } finally {
        clearTimeout(timeoutId);
        controllerRef.current = null;
        setUploading(false);
        setUploadingFileName("");
      }
    },
    [setLocation],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const dismissError = useCallback(() => setUploadError(""), []);

  return (
    <UploadContext.Provider
      value={{ uploading, uploadingFileName, uploadError, startUpload, cancel, dismissError }}
    >
      {children}
    </UploadContext.Provider>
  );
}
