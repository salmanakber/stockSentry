"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./IconSprite";

interface ToastContextValue {
  showToast: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((msg: string, durationMs = 3800) => {
    if (timer.current) window.clearTimeout(timer.current);
    setMessage(msg);
    setOn(true);
    timer.current = window.setTimeout(() => setOn(false), durationMs);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`toast${on ? " on" : ""}`} role="status">
        <Icon id="sh" />
        <span>{message}</span>
      </div>
    </ToastContext.Provider>
  );
}
