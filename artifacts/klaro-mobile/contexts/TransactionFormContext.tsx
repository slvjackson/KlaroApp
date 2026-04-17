import { useQueryClient } from "@tanstack/react-query";
import React, { createContext, useCallback, useContext, useState } from "react";
import { TransactionFormModal, type TransactionData } from "@/components/TransactionFormModal";

interface TransactionFormContextValue {
  openAdd: () => void;
  openEdit: (tx: TransactionData) => void;
}

const TransactionFormContext = createContext<TransactionFormContextValue | null>(null);

export function TransactionFormProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState<TransactionData | null>(null);

  const openAdd = useCallback(() => {
    setEditing(null);
    setVisible(true);
  }, []);

  const openEdit = useCallback((tx: TransactionData) => {
    setEditing(tx);
    setVisible(true);
  }, []);

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  return (
    <TransactionFormContext.Provider value={{ openAdd, openEdit }}>
      {children}
      <TransactionFormModal
        visible={visible}
        editing={editing}
        onClose={() => setVisible(false)}
        onSaved={handleSaved}
      />
    </TransactionFormContext.Provider>
  );
}

export function useTransactionForm() {
  const ctx = useContext(TransactionFormContext);
  if (!ctx) throw new Error("useTransactionForm must be used within TransactionFormProvider");
  return ctx;
}
