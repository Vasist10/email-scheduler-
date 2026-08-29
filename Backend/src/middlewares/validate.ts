import { Request, Response, NextFunction } from "express";

type FieldRule = {
  /** Primitive type check */
  type?: "string" | "number" | "boolean" | "array";
  /** Default: field is required. Set false to make optional. */
  required?: boolean;
};

/**
 * Lightweight body validator.
 * Supports primitive types and arrays.
 * Usage:
 *   router.post("/schedule", authMiddleware, validate({ recipients: { type: "array" }, subject: {}, ... }), handler)
 */
export const validate =
  (fields: Record<string, FieldRule>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const [field, rule] of Object.entries(fields)) {
      const value = (req.body as Record<string, unknown>)[field];

      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (rule.required !== false && isEmpty) {
        missing.push(field);
        continue;
      }

      if (value !== undefined && value !== null && rule.type) {
        if (rule.type === "array" && !Array.isArray(value)) {
          invalid.push(`${field} must be an array`);
        } else if (rule.type !== "array" && typeof value !== rule.type) {
          invalid.push(`${field} must be a ${rule.type}`);
        }
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        message: "Missing required fields",
        fields: missing,
      });
    }

    if (invalid.length > 0) {
      return res.status(400).json({
        message: "Invalid field types",
        fields: invalid,
      });
    }

    next();
  };
