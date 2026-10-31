"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "loading";

type ToastMethod = (title: string, options?: Record<string, unknown>) => unknown;

const toastMethods: Record<ToastVariant, ToastMethod> = {
  default: toast,
  success: toast.success,
  error: toast.error,
  warning: toast.warning,
  info: toast.info,
  loading: toast.loading,
};

export function showToast(options: {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
}) {
  const { variant = "default" } = options;
  return toastMethods[variant](options.title, {
    description: options.description,
    duration: options.duration ?? (options.variant === "loading" ? Infinity : 5000),
    action: options.action,
    dismissible: options.dismissible ?? true,
  });
}

export function showSuccess(title: string, description?: string, action?: { label: string; onClick: () => void }) {
  return showToast({ title, description, variant: "success", action });
}

export function showError(title: string, description?: string, action?: { label: string; onClick: () => void }) {
  return showToast({ title, description, variant: "error", action });
}

export function showWarning(title: string, description?: string, action?: { label: string; onClick: () => void }) {
  return showToast({ title, description, variant: "warning", action });
}

export function showInfo(title: string, description?: string, action?: { label: string; onClick: () => void }) {
  return showToast({ title, description, variant: "info", action });
}

export function showLoading(title: string, description?: string) {
  return showToast({ title, description, variant: "loading", duration: Infinity, dismissible: false });
}

export { toast } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      expand={true}
      gap={12}
      richColors
      className="z-[100]"
    />
  );
}