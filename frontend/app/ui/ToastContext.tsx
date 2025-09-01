"use client";
import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

export type Toast = { id: string; message: string; type?: "info" | "error" | "success" };

interface ToastContextValue {
  toasts: Toast[];
  show: (message: string, type?: Toast["type"]) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = Math.random().toString(36).slice(2, 8);
    const toast: Toast = { id, message, type };
    setToasts((t) => [...t, toast]);
    // auto-dismiss after 4s
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Renderer */}
      <div style={{ position: "fixed", right: 16, top: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 1000 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            padding: "10px 12px",
            borderRadius: 6,
            color: t.type === "error" ? "#721c24" : t.type === "success" ? "#155724" : "#084298",
            background: t.type === "error" ? "#f8d7da" : t.type === "success" ? "#d4edda" : "#cfe2ff",
            border: "1px solid rgba(0,0,0,0.1)",
            minWidth: 240,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <span>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
