import type { UseFormReturn } from "react-hook-form";

import { formatCEP, onlyDigits } from "@/lib/masks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type AddressFieldsProps = {
  form: UseFormReturn<any>;
  prefix?: string;
  idPrefix?: string;
  disabled?: boolean;
  showTitle?: boolean;
  stateOptions?: string[];
  className?: string;
  zipInvalid?: boolean;
  zipInvalidMessage?: string;
};

export function AddressFields({
  form,
  prefix,
  idPrefix = "endereco",
  disabled = false,
  showTitle = true,
  stateOptions,
  className,
  zipInvalid,
  zipInvalidMessage = "CEP incompleto. Informe 8 dígitos."
}: AddressFieldsProps) {
  const fieldName = (name: string) => (prefix ? `${prefix}.${name}` : name);
  const stateError = form.getFieldState(fieldName("address_state"), form.formState).error?.message;
  const zipError = form.getFieldState(fieldName("address_zip"), form.formState).error?.message;
  const wrapperClassName = ["rounded-xl border border-border/15 bg-card/20 p-3 backdrop-blur", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      {showTitle ? <div className="text-sm font-semibold">Endereço</div> : null}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="space-y-1 md:col-span-4">
          <Label htmlFor={`${idPrefix}_rua`}>Rua</Label>
          <Input
            id={`${idPrefix}_rua`}
            placeholder="Ex: Rua das Flores"
            disabled={disabled}
            {...form.register(fieldName("address_street"))}
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`${idPrefix}_numero`}>Nº</Label>
          <Input
            id={`${idPrefix}_numero`}
            placeholder="Ex: 123"
            disabled={disabled}
            {...form.register(fieldName("address_number"))}
          />
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label htmlFor={`${idPrefix}_complemento`}>Complemento</Label>
          <Input
            id={`${idPrefix}_complemento`}
            placeholder="Ex: Sala 402"
            disabled={disabled}
            {...form.register(fieldName("address_complement"))}
          />
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label htmlFor={`${idPrefix}_bairro`}>Bairro</Label>
          <Input
            id={`${idPrefix}_bairro`}
            placeholder="Ex: Centro"
            disabled={disabled}
            {...form.register(fieldName("address_neighborhood"))}
          />
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label htmlFor={`${idPrefix}_cidade`}>Cidade</Label>
          <Input
            id={`${idPrefix}_cidade`}
            placeholder="Ex: Rio de Janeiro"
            disabled={disabled}
            {...form.register(fieldName("address_city"))}
          />
        </div>
        <div className="space-y-1 md:col-span-1">
          <Label htmlFor={`${idPrefix}_uf`}>UF</Label>
          {stateOptions ? (
            <Select id={`${idPrefix}_uf`} disabled={disabled} {...form.register(fieldName("address_state"))}>
              <option value="">UF</option>
              {stateOptions.map((uf) => (
                <option key={`addr-${uf}`} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`${idPrefix}_uf`}
              placeholder="Ex: RJ"
              disabled={disabled}
              {...form.register(fieldName("address_state"))}
            />
          )}
          {stateError ? <p className="text-xs text-destructive">{stateError}</p> : null}
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={`${idPrefix}_cep`}>CEP</Label>
          <Input
            id={`${idPrefix}_cep`}
            inputMode="numeric"
            placeholder="Ex: 00000-000"
            disabled={disabled}
            {...form.register(fieldName("address_zip"), {
              onChange: (event) => {
                const digits = onlyDigits(event.target.value);
                const limited = digits.slice(0, 8);
                const formatted = formatCEP(limited);
                form.setValue(fieldName("address_zip"), formatted, { shouldValidate: true });
              }
            })}
          />
          {zipError ? (
            <p className="text-xs text-destructive">{zipError}</p>
          ) : zipInvalid ? (
            <p className="text-xs text-destructive">{zipInvalidMessage}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
