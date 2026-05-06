import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET /kyc/me ───────────────────────────────────────────────
router.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  const kyc = await prisma.kycRecord.findUnique({
    where: { memberId: req.user!.id },
  });
  res.json(kyc || { status: 'NONE' });
});

// ── POST /kyc/submit ──────────────────────────────────────────
router.post('/submit', authenticate, [
  body('nom').trim().isLength({ min: 2 }),
  body('prenom').trim().isLength({ min: 2 }),
  body('dateNaissance').notEmpty(),
  body('nationalite').notEmpty(),
  body('adresse').trim().isLength({ min: 10 }),
  body('docType').isIn(['passport', 'cni', 'permis', 'titre_sejour']),
  body('proofType').isIn(['facture', 'releve_bancaire', 'avis_impot', 'bail']),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const existing = await prisma.kycRecord.findUnique({
    where: { memberId: req.user!.id },
  });

  const data = {
    ...req.body,
    status: 'PENDING' as const,
    rejectionReason: null,
    reviewedById: null,
    reviewedAt: null,
    submittedAt: new Date(),
  };

  const kyc = existing
    ? await prisma.kycRecord.update({ where: { memberId: req.user!.id }, data })
    : await prisma.kycRecord.create({ data: { ...data, memberId: req.user!.id } });

  // Mettre à jour le statut KYC de l'user
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { kycStatus: 'PENDING' },
  });

  // Notifier l'admin
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: 'info',
      icon: '🪪',
      title: 'Nouveau dossier KYC',
      message: `${req.user!.email} a soumis son dossier KYC`,
      entityType: 'kyc',
      entityId: kyc.id,
    })),
  });

  res.json(kyc);
});

// ── GET /kyc (admin) ─────────────────────────────────────────
router.get('/', authenticate, requireAdmin, async (req: any, res: any) => {
  const { status, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: any = {};
  if (status && status !== 'all') where.status = status;

  const [kycs, total] = await Promise.all([
    prisma.kycRecord.findMany({
      where,
      include: {
        member: {
          select: { id: true, name: true, email: true, country: true, initials: true },
        },
      },
      skip,
      take: parseInt(limit),
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.kycRecord.count({ where }),
  ]);

  res.json({
    data: kycs,
    meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
  });
});

// ── PATCH /kyc/:id/approve (admin) ───────────────────────────
router.patch('/:id/approve', authenticate, requireAdmin, async (req: AuthRequest, res: any) => {
  const kyc = await prisma.kycRecord.update({
    where: { id: req.params.id },
    data: {
      status: 'APPROVED',
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
      adminNotes: req.body.notes,
    },
    include: { member: true },
  });

  // Mettre à jour statut user
  await prisma.user.update({
    where: { id: kyc.memberId },
    data: { kycStatus: 'APPROVED' },
  });

  // Notifier le membre
  await prisma.notification.create({
    data: {
      userId: kyc.memberId,
      type: 'success',
      icon: '✅',
      title: 'KYC validé',
      message: 'Votre identité a été vérifiée. Vous pouvez désormais investir.',
      entityType: 'kyc',
      entityId: kyc.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'KYC_APPROVED',
      actorId: req.user!.id,
      actorRole: req.user!.role,
      target: kyc.member.name,
      type: 'member',
      severity: 'success',
    },
  });

  res.json(kyc);
});

// ── PATCH /kyc/:id/reject (admin) ────────────────────────────
router.patch('/:id/reject', authenticate, requireAdmin, [
  body('reason').trim().isLength({ min: 10 }),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const kyc = await prisma.kycRecord.update({
    where: { id: req.params.id },
    data: {
      status: 'REJECTED',
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
      rejectionReason: req.body.reason,
    },
    include: { member: true },
  });

  await prisma.user.update({
    where: { id: kyc.memberId },
    data: { kycStatus: 'REJECTED' },
  });

  await prisma.notification.create({
    data: {
      userId: kyc.memberId,
      type: 'warn',
      icon: '❌',
      title: 'KYC rejeté',
      message: `Motif : ${req.body.reason}`,
      entityType: 'kyc',
      entityId: kyc.id,
    },
  });

  res.json(kyc);
});

// ── PATCH /kyc/:id/reviewing (admin) ─────────────────────────
router.patch('/:id/reviewing', authenticate, requireAdmin, async (req: AuthRequest, res: any) => {
  const kyc = await prisma.kycRecord.update({
    where: { id: req.params.id },
    data: { status: 'REVIEWING' },
    include: { member: { select: { kycStatus: true } } },
  });

  await prisma.user.update({
    where: { id: kyc.memberId },
    data: { kycStatus: 'REVIEWING' },
  });

  res.json(kyc);
});

export default router;
