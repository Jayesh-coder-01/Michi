export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: APIError | null;
}
