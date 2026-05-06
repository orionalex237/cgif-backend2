// ─── src/utils/prismaErrorHandler.ts ─────────────────────────────────────────
// Transforme les erreurs Prisma en réponses HTTP claires
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export function prismaErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  // Erreurs Prisma connues
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint failed
        const field = Array.isArray(err.meta?.target)
          ? (err.meta?.target as string[]).join(', ')
          : 'champ';
        return res.status(409).json({
          error: `Valeur déjà utilisée pour : ${field}`,
          code: 'DUPLICATE',
        });
      }
      case 'P2025':
        // Record not found
        return res.status(404).json({
          error: 'Enregistrement introuvable',
          code: 'NOT_FOUND',
        });
      case 'P2003':
        // Foreign key constraint failed
        return res.status(400).json({
          error: 'Référence invalide — l\'élément lié n\'existe pas',
          code: 'INVALID_REFERENCE',
        });
      case 'P2014':
        // Relation violation
        return res.status(400).json({
          error: 'Violation de contrainte de relation',
          code: 'RELATION_VIOLATION',
        });
      default:
        console.error(`[Prisma P${err.code}]`, err.message);
        return res.status(500).json({ error: 'Erreur base de données', code: err.code });
    }
  }

  // Erreur de validation Prisma (ex: champ manquant)
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[Prisma Validation]', err.message);
    return res.status(400).json({ error: 'Données invalides pour la base de données', code: 'VALIDATION_ERROR' });
  }

  // Erreur de connexion
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error('[Prisma Init]', err.message);
    return res.status(503).json({ error: 'Service de base de données indisponible', code: 'DB_UNAVAILABLE' });
  }

  // Autres erreurs — passer au handler suivant
  next(err);
}

// ── Handler final générique ───────────────────────────────────────────────────

export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Erreur interne du serveur';

  if (status >= 500) {
    console.error('[Erreur 500]', err);
  }

  res.status(status).json({ error: message });
}
