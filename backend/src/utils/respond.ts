import type { Response } from 'express';
import type { ApiSuccess } from '../types/api.js';

/** Single place the success envelope is constructed. */
export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(status).json(body);
}
