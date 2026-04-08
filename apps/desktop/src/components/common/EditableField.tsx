import { useState, useRef, useEffect, type InputHTMLAttributes } from 'react';

interface EditableFieldProps {
  value: string;
  onCommit: (value: string) => void;
  displayClassName?: string;
  inputClassName?: string;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  validate?: (value: string) => boolean;
  renderDisplay?: (value: string, startEditing: () => void) => React.ReactNode;
}

export default function EditableField({
  value,
  onCommit,
  displayClassName = 'cursor-pointer hover:text-ghost-green transition-colors',
  inputClassName = 'ghost-input text-sm px-1.5 py-0.5 w-full',
  inputProps,
  validate,
  renderDisplay,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      if (!validate || validate(trimmed)) {
        onCommit(trimmed);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') inputRef.current?.blur();
          if (e.key === 'Escape') cancel();
        }}
        className={inputClassName}
        {...inputProps}
      />
    );
  }

  if (renderDisplay) {
    return <>{renderDisplay(value, () => setEditing(true))}</>;
  }

  return (
    <span className={displayClassName} onClick={() => setEditing(true)}>
      {value}
    </span>
  );
}
