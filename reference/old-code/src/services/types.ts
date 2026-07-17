export interface ServiceResult<T> {
  data: T | null;
  error: string | null;
  offline: boolean;
}
