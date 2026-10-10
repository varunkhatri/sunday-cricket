"use client";
import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/actions";

type Action = (s: ActionState, fd: FormData) => Promise<ActionState>;

export function Submit({ children, className = "btn-primary", pendingText = "Saving…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? pendingText : children}</button>;
}

/** A form wired to a server action, showing the error/success message under it. */
export default function ActionForm({ action, children, className, resetOnSuccess = false }: {
  action: Action; children: React.ReactNode; className?: string; resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 rounded-lg bg-pitch-50 px-3 py-2 text-sm font-medium text-pitch-700">✓ {state.ok}</p>}
    </form>
  );
}

export function ConfirmButton({ children, message, className = "btn-danger" }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
