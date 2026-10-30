import React, { useState, useEffect, useRef } from 'react';

interface InlineEditableProps {
  value: string | number | null | undefined;
  onSave: (val: string) => void;
  multiline?: boolean;
  type?: 'text' | 'number';
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'td' | 'strong';
  disabled?: boolean;
  hint?: string;
}

export const InlineEditable: React.FC<InlineEditableProps> = ({
  value,
  onSave,
  multiline = false,
  type = 'text',
  className = '',
  inputClassName = '',
  placeholder = 'Double-click to edit...',
  as: Component = 'span',
  disabled = false,
  hint = 'Double-click to edit'
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState<string>(value == null ? '' : String(value));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCurrentVal(value == null ? '' : String(value));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (currentVal !== (value == null ? '' : String(value))) {
      onSave(currentVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setCurrentVal(value == null ? '' : String(value));
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      setIsEditing(false);
      if (currentVal !== (value == null ? '' : String(value))) {
        onSave(currentVal);
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && multiline) {
      e.preventDefault();
      setIsEditing(false);
      if (currentVal !== (value == null ? '' : String(value))) {
        onSave(currentVal);
      }
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={currentVal}
          onChange={(e) => setCurrentVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full p-1.5 bg-blue-50/60 border-2 border-blue-500 rounded text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs font-sans ${inputClassName}`}
          rows={Math.min(10, Math.max(2, currentVal.split('\n').length + 1))}
          placeholder={placeholder}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={currentVal}
        onChange={(e) => setCurrentVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full px-1.5 py-0.5 bg-blue-50/60 border-2 border-blue-500 rounded text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs ${inputClassName}`}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  const displayText = value == null || String(value).trim() === '' ? (
    <span className="text-slate-400 italic text-[11px]">{placeholder}</span>
  ) : (
    value
  );

  return (
    <Component
      onDoubleClick={handleDoubleClick}
      title={disabled ? undefined : `${hint} (press Enter to save)`}
      className={`group relative transition-all duration-150 ${
        disabled
          ? ''
          : 'hover:outline hover:outline-dashed hover:outline-1 hover:outline-blue-400 hover:bg-blue-50/40 rounded-xs cursor-text'
      } ${className}`}
    >
      {displayText}
    </Component>
  );
};
