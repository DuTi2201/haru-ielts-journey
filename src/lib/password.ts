export const MIN_PASSWORD_LENGTH = 8;
/** What the server's hashing reads; a longer password would be cut silently, so it is refused. */
export const MAX_PASSWORD_BYTES = 72;

/** What is wrong with the new password, before asking the server; null when it can be sent. */
export function passwordProblem(current: string, next: string, again: string): string | null {
  if (!current) return "Nhập mật khẩu hiện tại.";
  if (next.length < MIN_PASSWORD_LENGTH)
    return `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  if (new TextEncoder().encode(next).length > MAX_PASSWORD_BYTES)
    return "Mật khẩu mới quá dài (tối đa 72 byte; chữ có dấu tính nhiều hơn 1).";
  if (next === current) return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  if (next !== again) return "Hai lần nhập mật khẩu mới chưa giống nhau.";
  return null;
}
