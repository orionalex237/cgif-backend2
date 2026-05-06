import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const signTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
};

// ── POST /auth/register ───────────────────────────────────────
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('8 caractères minimum'),
  body('name').trim().isLength({ min: 2 }),
  body('country').trim().notEmpty(),
], async (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { email, password, name, country, domain, clusterId, referralCode } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 3).toUpperCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email, passwordHash, name, initials,
        country, domain, clusterId: clusterId || null,
        status: 'PENDING',
        role: 'MEMBER',
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    // Traiter le code de parrainage si fourni
    if (referralCode) {
      const parrain = await prisma.user.findFirst({
        where: { email: { contains: referralCode.split('-')[2]?.toLowerCase() } },
      });
      if (parrain) {
        await prisma.parrainage.create({
          data: { parrainId: parrain.id, filleulId: user.id, code: referralCode },
        });
      }
    }

    res.status(201).json({
      message: 'Compte créé. En attente de validation par l\'administration CGIF.',
      user,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { cluster: { select: { id: true, name: true } } },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Compte en attente de validation' });
    }
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Compte suspendu. Contactez l\'administration.' });
    }
    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'Compte banni.' });
    }

    const { accessToken, refreshToken } = signTokens(user.id, user.role);

    // Stocker le refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Mettre à jour lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const { passwordHash: _, ...safeUser } = user;
    res.json({ accessToken, refreshToken, user: safeUser });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /auth/refresh ────────────────────────────────────────
router.post('/refresh', async (req: any, res: any) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token manquant' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expirée' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });

    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });

    const tokens = signTokens(user.id, user.role);

    // Rotation du refresh token
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    res.json(tokens);
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────
router.post('/logout', authenticate, async (req: any, res: any) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  res.json({ message: 'Déconnecté' });
});

// ── GET /auth/me ──────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      cluster: { select: { id: true, name: true } },
      kycRecord: { select: { status: true } },
      ndaRecord: { select: { status: true, version: true } },
    },
    omit: { passwordHash: true },
  });
  res.json(user);
});

// ── POST /auth/change-password ────────────────────────────────
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  // Invalider tous les refresh tokens
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  res.json({ message: 'Mot de passe modifié. Reconnectez-vous.' });
});

export default router;
