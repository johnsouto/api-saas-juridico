import * as React from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilePickerProps = {
  value?: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  helperText?: string;
  maxSizeMb?: number;
  id?: string;
  className?: string;
};

export function FilePicker({
  value,
  onChange,
  accept,
  disabled,
  helperText,
  maxSizeMb,
  id,
  className
}: FilePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const [error, setError] = React.useState<string | null>(null);

  const openPicker = React.useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleFileChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0] ?? null;

      if (selected && maxSizeMb && selected.size > maxSizeMb * 1024 * 1024) {
        setError(`Arquivo acima do limite de ${maxSizeMb} MB.`);
        event.target.value = "";
        onChange(null);
        return;
      }

      setError(null);
      onChange(selected);
    },
    [maxSizeMb, onChange]
  );

  const handleClear = React.useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    setError(null);
    onChange(null);
  }, [onChange]);

  return (
    <div className={cn("space-y-1", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={handleFileChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 border-border/25 text-[#234066] hover:text-[#234066] dark:text-[#234066] dark:hover:text-[#234066]"
          onClick={openPicker}
          disabled={disabled}
        >
          <Upload className="mr-2 h-4 w-4" />
          Selecionar arquivo
        </Button>

        <span className="max-w-full truncate text-sm text-[#888]">
          {value ? value.name : "Nenhum arquivo selecionado"}
        </span>

        {value ? (
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-[#888]" onClick={handleClear} disabled={disabled}>
            Remover
          </Button>
        ) : null}
      </div>

      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
