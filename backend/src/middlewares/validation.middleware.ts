import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

type ValidationRule = {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
};

export function validate(rules: ValidationRule[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`Campo '${rule.field}' é obrigatório`);
        continue;
      }

      if (value === undefined || value === null || value === '') continue;

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`Campo '${rule.field}' deve ser texto`);
      }

      if (rule.type === 'number' && (typeof value !== 'number' || isNaN(value))) {
        errors.push(`Campo '${rule.field}' deve ser numérico`);
      }

      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Campo '${rule.field}' deve ser booleano`);
      }

      if (rule.type === 'email' && typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`Campo '${rule.field}' deve ser um email válido`);
        }
      }

      if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
        errors.push(`Campo '${rule.field}' deve ter no mínimo ${rule.minLength} caracteres`);
      }

      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        errors.push(`Campo '${rule.field}' deve ter no máximo ${rule.maxLength} caracteres`);
      }

      if (rule.min !== undefined && typeof value === 'number' && value < rule.min) {
        errors.push(`Campo '${rule.field}' deve ser no mínimo ${rule.min}`);
      }

      if (rule.max !== undefined && typeof value === 'number' && value > rule.max) {
        errors.push(`Campo '${rule.field}' deve ser no máximo ${rule.max}`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors.join('; '));
    }

    next();
  };
}
