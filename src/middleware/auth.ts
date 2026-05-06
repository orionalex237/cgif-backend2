// ─── src/middleware/auth.ts ───────────────────────────────────────────────────
// Middleware d'authentification JWT avec blacklist Redis
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index.js';
import { isTokenBlacklisted } from '../services/redis.js';

export interface AuthRequest extends Request {
  user?: {
    id:     string;
    email:  string;
    role:   string;
    status: string;
  };
}

// ── Authentification JWT ──────────────────────────────────────────────────────

export const authenticate = async (
  req: AuthRequest, res: Response, next: NextFunction,
) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou mal formé' });
  }

  const token = auth.split(' ')[1];

  try {
    // Vérifier si le token est révoqué (blacklist Redis)
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Token révoqué' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user)              return res.status(401).json({ error: 'Utilisateur introuvable' });
    if (user.status === 'BANNED')    return res.status(403).json({ error: 'Compte banni' });
    if (user.status === 'SUSPENDED') return res.status(403).json({ error: 'Compte suspendu' });
    if (user.status === 'PENDING')   return res.status(403).json({ error: 'Compte en attente de validation' });

    req.user = user;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// ── Vérification de rôle ──────────────────────────────────────────────────────

export const requireRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user)                    return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé — permissions insuffisantes' });
    }
    next();
  };

export const requireAdmin     = requireRole('ADMIN');
export const requireModerator = requireRole('ADMIN', 'MODERATOR');

// ── KYC obligatoire pour investir ────────────────────────────────────────────

export const requireKyc = async (
  req: AuthRequest, res: Response, next: NextFunction,
) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  const kyc = await prisma.kycRecord.findUnique({
    where: { memberId: req.user.id },
    select: { status: true },
  });

  if (!kyc || kyc.status !== 'APPROVED') {
    return res.status(403).json({
      error: 'KYC non validé',
      kycStatus: kyc?.status || 'NONE',
      message: 'Votre identité doit être vérifiée avant de pouvoir investir.',
    });
  }

  next();
};

// ── NDA obligatoire ───────────────────────────────────────────────────────────

export const requireNda = async (
  req: AuthRequest, res: Response, next: NextFunction,
) => {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });

  const nda = await prisma.ndaRecord.findUnique({
    where: { memberId: req.user.id },
    select: { status: true, expiresAt: true },
  });

  const valid = nda?.status === 'SIGNED' &&
                (!nda.expiresAt || nda.expiresAt > new Date());

  if (!valid) {
    return res.status(403).json({
      error: 'NDA non signé ou expiré',
      message: 'Vous devez signer l\'accord de confidentialité pour accéder à ce contenu.',
    });
  }

  next();
};
