'use client';

import type { ReactNode } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { NOTE_MAX_LENGTH } from '@/lib/trade/api';

interface NoteFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NoteField({ id, label, value, onChange, placeholder, disabled }: NoteFieldProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <Textarea
        id={id}
        className="min-h-20"
        maxLength={NOTE_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-describedby={`${id}-count`}
      />
      <p id={`${id}-count`} className="text-right text-xs text-muted-foreground">
        {value.length}/{NOTE_MAX_LENGTH} characters
      </p>
    </div>
  );
}

/** Checkbox the backend requires when values are unknown or the gap exceeds a member's limit. */
export function ValueAcknowledgement({ id, checked, onChange, disabled, children }: {
  id: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-ring/40 p-3 text-sm">
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id} className="leading-5">{children}</label>
    </div>
  );
}
