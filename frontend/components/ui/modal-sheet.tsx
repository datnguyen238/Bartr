"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { Dialog } from "radix-ui";
import { Button } from "./button";

export function ModalSheet({ open, onOpenChange, title, description, children, returnFocusRef, fallbackFocusRef, className }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const invoker = useRef<HTMLElement | null>(null);

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="modal-overlay" data-slot="modal-overlay" />
      <Dialog.Content className={["modal-sheet", className].filter(Boolean).join(" ")} data-slot="modal-content" aria-modal="true" onOpenAutoFocus={event => {
        invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        event.preventDefault();
        heading.current?.focus();
      }} onCloseAutoFocus={event => {
        event.preventDefault();
        const target = [returnFocusRef?.current, invoker.current, fallbackFocusRef?.current].find(element => element?.isConnected && element !== document.body && !element.closest("[hidden]") && !("disabled" in element && element.disabled));
        (target ?? document.getElementById("main-content"))?.focus();
      }}>
        <header className="modal-sheet-header">
          <div className="min-w-0">
            <Dialog.Title asChild><h2 className="modal-sheet-title" ref={heading} tabIndex={-1}>{title}</h2></Dialog.Title>
            <Dialog.Description className={description ? "modal-sheet-description" : "sr-only"}>{description || "Close to return to the previous screen."}</Dialog.Description>
          </div>
          <Dialog.Close asChild><Button className="modal-sheet-close" type="button" variant="ghost" aria-label={`Close ${title}`}>Close</Button></Dialog.Close>
        </header>
        <div className="modal-sheet-body">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
