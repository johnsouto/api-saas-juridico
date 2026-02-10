export type PasswordValidation = {
  lengthOk: boolean;
  twoNumbersOk: boolean;
  specialOk: boolean;
  upperOk: boolean;
  lowerOk: boolean;
  allOk: boolean;
};

export const passwordPolicyMessage =
  "Senha fraca. Use no mínimo 8 caracteres, 2 números, 1 caractere especial, 1 letra maiúscula e 1 letra minúscula.";

export function validatePassword(password: string): PasswordValidation {
  const pwd = password ?? "";
  const numbers = (pwd.match(/\d/g) ?? []).length;
  const lengthOk = pwd.length >= 8;
  const twoNumbersOk = numbers >= 2;
  const specialOk = /[^A-Za-z0-9]/.test(pwd);
  const upperOk = /[A-Z]/.test(pwd);
  const lowerOk = /[a-z]/.test(pwd);
  return {
    lengthOk,
    twoNumbersOk,
    specialOk,
    upperOk,
    lowerOk,
    allOk: lengthOk && twoNumbersOk && specialOk && upperOk && lowerOk
  };
}

