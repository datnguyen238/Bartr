'use client';

import { Textarea } from '@/components/ui/textarea';
import { NOTE_MAX_LENGTH } from '@/lib/trade/types';

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
        rows={3}
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
