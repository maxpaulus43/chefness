import { createContext } from "react";

export type ToastTone = "default" | "success" | "danger";

export interface ToastNotifyOptions {
    title?: string;
    message: string;
    tone?: ToastTone;
    durationMs?: number;
}

export interface ToastAskOptions {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: ToastTone;
}

export interface ToastApi {
    notify: (options: ToastNotifyOptions | string) => string;
    ask: (options: ToastAskOptions | string) => Promise<boolean>;
    dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);