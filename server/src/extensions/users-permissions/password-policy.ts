/**
 * Единая политика паролей (server-side source of truth).
 *
 * Применяется ко ВСЕМ точкам входа пароля: регистрация, reset-password,
 * change-password. Клиентская валидация лишь дублирует эти правила для UX —
 * проверять обязательно на сервере, т.к. фронт можно обойти прямым вызовом API.
 *
 * Стандарт (соответствует распространённым требованиям и духу NIST SP 800-63B):
 *   - минимум 8 символов;
 *   - хотя бы одна заглавная буква;
 *   - хотя бы одна строчная буква;
 *   - хотя бы одна цифра;
 *   - хотя бы один спецсимвол;
 *   - не длиннее 72 байт (bcrypt молча обрезает всё после 72-го байта —
 *     более длинный пароль создал бы ложное чувство безопасности);
 *   - без пробелов в начале/конце (частый источник «не могу войти»).
 */

export const PASSWORD_POLICY = {
  minLength: 8,
  // bcrypt обрабатывает максимум 72 байта; ограничиваем явно.
  maxBytes: 72,
} as const;

export type PasswordPolicyErrorCode =
  | 'password_required'
  | 'password_too_short'
  | 'password_too_long'
  | 'password_whitespace_edges'
  | 'password_needs_uppercase'
  | 'password_needs_lowercase'
  | 'password_needs_digit'
  | 'password_needs_special';

export interface PasswordValidationResult {
  valid: boolean;
  code?: PasswordPolicyErrorCode;
  message?: string;
}

const MESSAGES: Record<PasswordPolicyErrorCode, string> = {
  password_required: 'Пароль обязателен.',
  password_too_short: `Пароль должен содержать минимум ${PASSWORD_POLICY.minLength} символов.`,
  password_too_long: 'Пароль слишком длинный (максимум 72 символа).',
  password_whitespace_edges: 'Пароль не должен начинаться или заканчиваться пробелом.',
  password_needs_uppercase: 'Пароль должен содержать хотя бы одну заглавную букву.',
  password_needs_lowercase: 'Пароль должен содержать хотя бы одну строчную букву.',
  password_needs_digit: 'Пароль должен содержать хотя бы одну цифру.',
  password_needs_special: 'Пароль должен содержать хотя бы один спецсимвол (например, ! @ # $ % & *).',
};

const fail = (code: PasswordPolicyErrorCode): PasswordValidationResult => ({
  valid: false,
  code,
  message: MESSAGES[code],
});

/**
 * Проверяет пароль по политике. Возвращает первую нарушенную проверку,
 * чтобы пользователь исправлял ошибки по одной (и чтобы не раскрывать
 * лишнего о структуре пароля).
 */
export const validatePassword = (password: unknown): PasswordValidationResult => {
  if (typeof password !== 'string' || password.length === 0) {
    return fail('password_required');
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    return fail('password_too_short');
  }

  if (Buffer.byteLength(password, 'utf8') > PASSWORD_POLICY.maxBytes) {
    return fail('password_too_long');
  }

  if (password !== password.trim()) {
    return fail('password_whitespace_edges');
  }

  if (!/[A-ZА-ЯЁ]/.test(password)) {
    return fail('password_needs_uppercase');
  }

  if (!/[a-zа-яё]/.test(password)) {
    return fail('password_needs_lowercase');
  }

  if (!/\d/.test(password)) {
    return fail('password_needs_digit');
  }

  // Любой не-буквенно-цифровой символ считается спецсимволом.
  if (!/[^\p{L}\p{N}]/u.test(password)) {
    return fail('password_needs_special');
  }

  return { valid: true };
};
