import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, requireAdmin, requireKyc, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET /projects ─────────────────────────────────────────────
router.get('/', authenticate, async (req: any, res: any) => {
  const { status, clusterId, page = '1', limit = '20', search } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (clusterId) where.clusterId = clusterId;
  if (search) where.title = { contains: search, mode: 'insensitive' };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        cluster: { select: { id: true, name: true } },
        _count: { select: { investments: true, documents: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.project.count({ where }),
  ]);

  res.json({
    data: projects,
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / take) },
  });
});

// ── GET /projects/:id ─────────────────────────────────────────
router.get('/:id', authenticate, async (req: any, res: any) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      cluster: true,
      documents: { include: { author: { select: { name: true, initials: true } } } },
      _count: { select: { investments: true } },
    },
  });
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });
  res.json(project);
});

// ── POST /projects ────────────────────────────────────────────
router.post('/', authenticate, [
  body('title').trim().isLength({ min: 5 }),
  body('targetAmount').isFloat({ min: 1 }),
  body('clusterId').notEmpty(),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const project = await prisma.project.create({
    data: {
      ...req.body,
      status: 'PENDING',
      submitterId: req.user!.id,
    },
  });

  // Log audit
  await prisma.auditLog.create({
    data: {
      action: 'PROJECT_SUBMITTED',
      actorId: req.user!.id,
      actorRole: req.user!.role,
      target: project.title,
      detail: `Projet soumis — objectif ${project.targetAmount}M FCFA`,
      type: 'project',
      severity: 'info',
      entityId: project.id,
    },
  });

  res.status(201).json(project);
});

// ── PATCH /projects/:id/status (admin) ───────────────────────
router.patch('/:id/status', authenticate, requireAdmin, [
  body('status').isIn(['PENDING', 'REVIEW', 'VOTING', 'FUNDING', 'FUNDED', 'DONE', 'REJECTED']),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      analystId: req.body.analystId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: `PROJECT_${req.body.status}`,
      actorId: req.user!.id,
      actorRole: req.user!.role,
      target: project.title,
      type: 'project',
      severity: req.body.status === 'REJECTED' ? 'warn' : 'success',
      entityId: project.id,
    },
  });

  res.json(project);
});

// ── GET /projects/:id/investments ─────────────────────────────
router.get('/:id/investments', authenticate, requireAdmin, async (req: any, res: any) => {
  const investments = await prisma.investment.findMany({
    where: { projectId: req.params.id },
    include: {
      member: { select: { id: true, name: true, email: true, country: true } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(investments);
});

// ── POST /projects/:id/invest ─────────────────────────────────
// Soumettre un vœu d'investissement
router.post('/:id/invest', authenticate, requireKyc, [
  body('amount').isFloat({ min: 5000 }),
  body('paymentMethod').isIn(['VIREMENT_SEPA', 'VIREMENT_SWIFT', 'ORANGE_MONEY', 'MTN_MOMO', 'WAVE']),
  body('memberNom').trim().notEmpty(),
  body('memberPrenom').trim().notEmpty(),
  body('memberDob').notEmpty(),
  body('memberNationality').notEmpty(),
  body('memberAddress').notEmpty(),
  body('memberIdDoc').notEmpty(),
  body('bankName').trim().notEmpty(),
  body('bankIban').trim().notEmpty(),
  body('bankHolder').trim().notEmpty(),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: 'Projet introuvable' });
  if (project.status !== 'FUNDING') {
    return res.status(400).json({ error: 'Ce projet n\'est pas en phase de financement' });
  }

  const { amount, sharePrice = 5000 } = req.body;
  const sharesCount = Math.floor(amount / sharePrice);
  const refVirement = `CGIF-${project.id.slice(-4).toUpperCase()}-${req.user!.id.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const investment = await prisma.investment.create({
    data: {
      memberId: req.user!.id,
      projectId: project.id,
      amount,
      sharePrice,
      sharesCount,
      paymentMethod: req.body.paymentMethod,
      status: 'VOEU_SOUMIS',
      refVirement,
      ...req.body,
    },
  });

  // Notification membre
  await prisma.notification.create({
    data: {
      userId: req.user!.id,
      type: 'info',
      icon: '💼',
      title: 'Vœu d\'investissement enregistré',
      message: `${amount.toLocaleString()} FCFA · ${project.title} · Réf: ${refVirement}`,
      entityType: 'investment',
      entityId: investment.id,
    },
  });

  res.status(201).json({ investment, bankInfo: {
    titulaire: 'CGIF SA — Cameroon Global Intelligence Forum',
    iban_europe: 'FR76 3000 6000 0112 3456 7890 189',
    swift_europe: 'AGRIFRPP',
    orange_money: '+237 699 000 001',
    mtn_momo: '+237 677 000 001',
    refVirement,
  }});
});

export default router;
