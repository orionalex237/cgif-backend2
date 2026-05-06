// ─── routes/users.ts ─────────────────────────────────────────────────────────
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { prisma } from '../index.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const usersRouter = Router();

// GET /users — liste membres (admin)
usersRouter.get('/', authenticate, requireAdmin, async (req: any, res: any) => {
  const { status, role, clusterId, page = '1', limit = '20', search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (status) where.status = status;
  if (role) where.role = role;
  if (clusterId) where.clusterId = clusterId;
  if (search) where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ];

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: parseInt(limit),
      include: {
        cluster: { select: { name: true } },
        kycRecord: { select: { status: true } },
      },
      omit: { passwordHash: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data: users, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

// GET /users/:id
usersRouter.get('/:id', authenticate, async (req: AuthRequest, res: any) => {
  // Un membre peut voir son propre profil, un admin peut voir n'importe qui
  const targetId = req.params.id === 'me' ? req.user!.id : req.params.id;
  if (req.user!.role !== 'ADMIN' && targetId !== req.user!.id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    include: {
      cluster: true,
      kycRecord: { select: { status: true, submittedAt: true } },
      ndaRecord: { select: { status: true, version: true, expiresAt: true } },
      investments: {
        where: { status: 'ACTIVE' },
        include: { project: { select: { title: true } } },
      },
    },
    omit: { passwordHash: true },
  });
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(user);
});

// PATCH /users/me — modifier son profil
usersRouter.patch('/me', authenticate, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('bio').optional().trim(),
  body('city').optional().trim(),
  body('phone').optional().trim(),
], async (req: AuthRequest, res: any) => {
  const { name, bio, city, country, phone, linkedinUrl, avatarUrl } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name, bio, city, country, phone, linkedinUrl, avatarUrl },
    omit: { passwordHash: true },
  });
  res.json(user);
});

// PATCH /users/:id/status (admin)
usersRouter.patch('/:id/status', authenticate, requireAdmin, [
  body('status').isIn(['ACTIVE', 'PENDING', 'SUSPENDED', 'BANNED']),
], async (req: AuthRequest, res: any) => {
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
    omit: { passwordHash: true },
  });

  await prisma.auditLog.create({
    data: {
      action: req.body.status === 'ACTIVE' ? 'MEMBER_VALIDATED' : `MEMBER_${req.body.status}`,
      actorId: req.user!.id, actorRole: req.user!.role,
      target: user.name, type: 'member',
      severity: req.body.status === 'SUSPENDED' ? 'warn' : 'info',
    },
  });

  res.json(user);
});

export { usersRouter };

// ─── routes/clusters.ts ───────────────────────────────────────────────────────
const clustersRouter = Router();

clustersRouter.get('/', authenticate, async (_req: any, res: any) => {
  const clusters = await prisma.cluster.findMany({
    include: { _count: { select: { members: true, projects: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(clusters);
});

clustersRouter.post('/', authenticate, requireAdmin, [
  body('name').trim().isLength({ min: 3 }),
], async (req: AuthRequest, res: any) => {
  const cluster = await prisma.cluster.create({ data: req.body });
  res.status(201).json(cluster);
});

clustersRouter.patch('/:id', authenticate, requireAdmin, async (req: any, res: any) => {
  const cluster = await prisma.cluster.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(cluster);
});

export { clustersRouter };

// ─── routes/posts.ts ─────────────────────────────────────────────────────────
const postsRouter = Router();

postsRouter.get('/', authenticate, async (req: any, res: any) => {
  const { status, section, clusterId, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = { status: 'APPROVED' }; // membres voient approuvés
  if (req.user?.role === 'ADMIN') delete where.status;
  if (status && req.user?.role === 'ADMIN') where.status = status;
  if (section) where.section = section.toUpperCase();
  if (clusterId) where.clusterId = clusterId;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where, skip, take: parseInt(limit),
      include: {
        author: { select: { id: true, name: true, initials: true, domain: true } },
        cluster: { select: { name: true } },
        _count: { select: { comments: true, pollVotes: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({ where }),
  ]);
  res.json({ data: posts, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

postsRouter.post('/', authenticate, [
  body('title').trim().isLength({ min: 5 }),
  body('body').trim().isLength({ min: 20 }),
  body('section').isIn(['DISCUSSION', 'PROJET', 'FINANCEMENT', 'SONDAGE']),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  const post = await prisma.post.create({
    data: { ...req.body, authorId: req.user!.id, status: 'PENDING' },
  });
  res.status(201).json(post);
});

postsRouter.patch('/:id/status', authenticate, requireAdmin, [
  body('status').isIn(['APPROVED', 'REJECTED']),
], async (req: AuthRequest, res: any) => {
  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });
  res.json(post);
});

postsRouter.post('/:id/vote', authenticate, async (req: AuthRequest, res: any) => {
  const { optionIndex } = req.body;
  const vote = await prisma.pollVote.upsert({
    where: { postId_userId: { postId: req.params.id, userId: req.user!.id } },
    create: { postId: req.params.id, userId: req.user!.id, optionIndex },
    update: { optionIndex },
  });
  res.json(vote);
});

postsRouter.get('/:id/comments', authenticate, async (req: any, res: any) => {
  const comments = await prisma.comment.findMany({
    where: { postId: req.params.id },
    include: { author: { select: { name: true, initials: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(comments);
});

postsRouter.post('/:id/comments', authenticate, [
  body('body').trim().isLength({ min: 2 }),
], async (req: AuthRequest, res: any) => {
  const comment = await prisma.comment.create({
    data: { body: req.body.body, postId: req.params.id, authorId: req.user!.id },
    include: { author: { select: { name: true, initials: true } } },
  });
  res.status(201).json(comment);
});

export { postsRouter };

// ─── routes/documents.ts ─────────────────────────────────────────────────────
const documentsRouter = Router();

documentsRouter.get('/', authenticate, async (req: any, res: any) => {
  const { status, projectId, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (status) where.status = status;
  if (projectId) where.projectId = projectId;

  const [docs, total] = await Promise.all([
    prisma.document.findMany({
      where, skip, take: parseInt(limit),
      include: {
        author: { select: { name: true, initials: true } },
        project: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.document.count({ where }),
  ]);
  res.json({ data: docs, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

documentsRouter.patch('/:id/classify', authenticate, requireAdmin, async (req: any, res: any) => {
  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data: {
      status: 'CLASSIFIED',
      aiTag: req.body.aiTag,
      aiConf: req.body.aiConf,
      aiSummary: req.body.aiSummary,
      projectId: req.body.projectId,
    },
  });
  res.json(doc);
});

export { documentsRouter };

// ─── routes/investments.ts ────────────────────────────────────────────────────
const investmentsRouter = Router();

investmentsRouter.get('/', authenticate, requireAdmin, async (req: any, res: any) => {
  const { status, projectId, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const VALID_NDA_STATUS = ['PENDING', 'SIGNED', 'EXPIRED'];
  const where: any = {};
  if (status && VALID_NDA_STATUS.includes(status)) where.status = status;
  if (projectId) where.projectId = projectId;

  const [investments, total] = await Promise.all([
    prisma.investment.findMany({
      where, skip, take: parseInt(limit),
      include: {
        member: { select: { name: true, email: true, country: true, initials: true } },
        project: { select: { title: true } },
      },
      orderBy: { submittedAt: 'desc' },
    }),
    prisma.investment.count({ where }),
  ]);
  res.json({ data: investments, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

investmentsRouter.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  const investments = await prisma.investment.findMany({
    where: { memberId: req.user!.id },
    include: {
      project: { select: { title: true, status: true } },
      dividends: true,
    },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(investments);
});

investmentsRouter.patch('/:id/send-bank-info', authenticate, requireAdmin, async (req: AuthRequest, res: any) => {
  const inv = await prisma.investment.update({
    where: { id: req.params.id },
    data: { status: 'COORDOS_ENVOYEES', bankInfoSentAt: new Date() },
    include: { member: true },
  });
  await prisma.notification.create({
    data: {
      userId: inv.memberId,
      type: 'info', icon: '🏦',
      title: 'Coordonnées bancaires CGIF envoyées',
      message: `Réf: ${inv.refVirement} — effectuez votre virement dans les 5 jours ouvrés`,
      entityType: 'investment', entityId: inv.id,
    },
  });
  res.json(inv);
});

investmentsRouter.patch('/:id/confirm', authenticate, requireAdmin, async (req: AuthRequest, res: any) => {
  const inv = await prisma.investment.update({
    where: { id: req.params.id },
    data: { status: 'VIREMENT_RECU', confirmedAt: new Date(), confirmedBy: req.user!.id, adminNotes: req.body.notes },
  });
  res.json(inv);
});

investmentsRouter.patch('/:id/activate', authenticate, requireAdmin, async (req: AuthRequest, res: any) => {
  const inv = await prisma.investment.update({
    where: { id: req.params.id },
    data: { status: 'ACTIVE', activatedAt: new Date() },
    include: { project: { select: { title: true, collectedAmount: true, sharesCount: true } } },
  });

  // Générer le certificat
  await prisma.certificate.create({
    data: {
      type: 'investissement',
      memberId: inv.memberId,
      investmentId: inv.id,
      projectId: inv.projectId,
      ref: `CERT-CGIF-${inv.projectId.slice(-4).toUpperCase()}-${inv.memberId.slice(-4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    },
  });

  // Mettre à jour le montant collecté du projet
  await prisma.project.update({
    where: { id: inv.projectId },
    data: {
      collectedAmount: { increment: inv.amount },
      progress: { set: Math.min(100, Math.round(((inv.project as any).collectedAmount + inv.amount) / (inv.project as any).targetAmount * 100)) },
    },
  });

  await prisma.notification.create({
    data: {
      userId: inv.memberId,
      type: 'success', icon: '🏆',
      title: `${inv.sharesCount} parts activées`,
      message: `Investissement confirmé sur "${(inv.project as any).title}"`,
      entityType: 'investment', entityId: inv.id,
    },
  });

  res.json(inv);
});

export { investmentsRouter };

// ─── routes/messages.ts ───────────────────────────────────────────────────────
const messagesRouter = Router();

messagesRouter.get('/inbox', authenticate, async (req: AuthRequest, res: any) => {
  const messages = await prisma.message.findMany({
    where: { receiverId: req.user!.id },
    include: { sender: { select: { name: true, initials: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(messages);
});

messagesRouter.post('/', authenticate, [
  body('receiverId').notEmpty(),
  body('subject').trim().isLength({ min: 2 }),
  body('body').trim().isLength({ min: 5 }),
], async (req: AuthRequest, res: any) => {
  const msg = await prisma.message.create({
    data: { ...req.body, senderId: req.user!.id },
  });
  res.status(201).json(msg);
});

messagesRouter.patch('/:id/read', authenticate, async (req: AuthRequest, res: any) => {
  const msg = await prisma.message.update({
    where: { id: req.params.id, receiverId: req.user!.id },
    data: { read: true, readAt: new Date() },
  });
  res.json(msg);
});

export { messagesRouter };

// ─── routes/notifications.ts ─────────────────────────────────────────────────
const notificationsRouter = Router();

notificationsRouter.get('/', authenticate, async (req: AuthRequest, res: any) => {
  const notifs = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifs);
});

notificationsRouter.patch('/read-all', authenticate, async (req: AuthRequest, res: any) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true, readAt: new Date() },
  });
  res.json({ message: 'Toutes les notifications lues' });
});

export { notificationsRouter };

// ─── routes/polls.ts ─────────────────────────────────────────────────────────
const pollsRouter = Router();

pollsRouter.get('/', authenticate, async (req: any, res: any) => {
  const polls = await prisma.poll.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { votes: true } } },
  });
  res.json(polls);
});

pollsRouter.post('/', authenticate, requireAdmin, [
  body('title').trim().notEmpty(),
  body('question').trim().notEmpty(),
  body('options').isArray({ min: 2 }),
], async (req: AuthRequest, res: any) => {
  const poll = await prisma.poll.create({
    data: { ...req.body, creatorId: req.user!.id },
  });
  res.status(201).json(poll);
});

pollsRouter.post('/:id/vote', authenticate, async (req: AuthRequest, res: any) => {
  const vote = await prisma.vote.upsert({
    where: { pollId_userId: { pollId: req.params.id, userId: req.user!.id } },
    create: { pollId: req.params.id, userId: req.user!.id, optionIndex: req.body.optionIndex },
    update: { optionIndex: req.body.optionIndex },
  });
  res.json(vote);
});

export { pollsRouter };

// ─── routes/announcements.ts ─────────────────────────────────────────────────
const announcementsRouter = Router();

announcementsRouter.get('/', authenticate, async (req: any, res: any) => {
  const where: any = { status: 'published' };
  if (req.user?.role === 'ADMIN') delete where.status;
  const announcements = await prisma.announcement.findMany({
    where, orderBy: { createdAt: 'desc' },
  });
  res.json(announcements);
});

announcementsRouter.post('/', authenticate, requireAdmin, [
  body('title').trim().notEmpty(),
  body('body').trim().notEmpty(),
], async (req: AuthRequest, res: any) => {
  const ann = await prisma.announcement.create({
    data: { ...req.body, authorId: req.user!.id },
  });
  res.status(201).json(ann);
});

export { announcementsRouter };

// ─── routes/events.ts ────────────────────────────────────────────────────────
const eventsRouter = Router();

eventsRouter.get('/', authenticate, async (_req: any, res: any) => {
  const events = await prisma.event.findMany({
    include: { _count: { select: { registrations: true } }, cluster: { select: { name: true } } },
    orderBy: { eventDate: 'asc' },
  });
  res.json(events);
});

eventsRouter.post('/', authenticate, requireAdmin, [
  body('titre').trim().notEmpty(),
  body('eventDate').isISO8601(),
], async (req: AuthRequest, res: any) => {
  const event = await prisma.event.create({
    data: { ...req.body, organisateurId: req.user!.id },
  });
  res.status(201).json(event);
});

eventsRouter.post('/:id/register', authenticate, async (req: AuthRequest, res: any) => {
  const reg = await prisma.eventRegistration.upsert({
    where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
    create: { eventId: req.params.id, userId: req.user!.id },
    update: {},
  });
  res.json(reg);
});

eventsRouter.delete('/:id/register', authenticate, async (req: AuthRequest, res: any) => {
  await prisma.eventRegistration.delete({
    where: { eventId_userId: { eventId: req.params.id, userId: req.user!.id } },
  });
  res.json({ message: 'Désinscription effectuée' });
});

export { eventsRouter };

// ─── routes/news.ts ──────────────────────────────────────────────────────────
const newsRouter = Router();

newsRouter.get('/', authenticate, async (req: any, res: any) => {
  const { cluster, domaine, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (cluster) where.cluster = cluster;
  if (domaine) where.domaine = domaine;

  const [articles, total] = await Promise.all([
    prisma.newsArticle.findMany({ where, skip, take: parseInt(limit), orderBy: { publishedAt: 'desc' } }),
    prisma.newsArticle.count({ where }),
  ]);
  res.json({ data: articles, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

newsRouter.post('/:id/like', authenticate, async (req: any, res: any) => {
  const article = await prisma.newsArticle.update({
    where: { id: req.params.id },
    data: { likes: { increment: 1 } },
  });
  res.json(article);
});

export { newsRouter };

// ─── routes/parrainage.ts ────────────────────────────────────────────────────
const parrainageRouter = Router();

parrainageRouter.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  const parrainages = await prisma.parrainage.findMany({
    where: { parrainId: req.user!.id },
    include: { filleul: { select: { name: true, email: true, createdAt: true } } },
  });
  const points = parrainages.reduce((a, p) => a + p.points, 0);
  res.json({ parrainages, stats: { total: parrainages.length, confirmes: parrainages.filter(p => p.status === 'actif').length, points } });
});

export { parrainageRouter };

// ─── routes/analytics.ts ─────────────────────────────────────────────────────
const analyticsRouter = Router();

analyticsRouter.get('/dashboard', authenticate, requireAdmin, async (_req: any, res: any) => {
  const [
    totalUsers, activeUsers, pendingKyc, totalProjects, fundingProjects,
    totalInvestments, activeInvestments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.kycRecord.count({ where: { status: { in: ['PENDING', 'REVIEWING'] } } }),
    prisma.project.count(),
    prisma.project.count({ where: { status: 'FUNDING' } }),
    prisma.investment.count(),
    prisma.investment.count({ where: { status: 'ACTIVE' } }),
  ]);

  const totalRaised = await prisma.investment.aggregate({
    where: { status: 'ACTIVE' },
    _sum: { amount: true },
  });

  res.json({
    users: { total: totalUsers, active: activeUsers, pendingKyc },
    projects: { total: totalProjects, funding: fundingProjects },
    investments: { total: totalInvestments, active: activeInvestments, raised: totalRaised._sum.amount || 0 },
  });
});

export { analyticsRouter };

// ─── routes/audit.ts ─────────────────────────────────────────────────────────
const auditRouter = Router();

auditRouter.get('/', authenticate, requireAdmin, async (req: any, res: any) => {
  const { type, severity, page = '1', limit = '30' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where: any = {};
  if (type) where.type = type;
  if (severity) where.severity = severity;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, skip, take: parseInt(limit),
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ data: logs, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

export { auditRouter };

// ─── routes/nda.ts ───────────────────────────────────────────────────────────
const ndaRouter = Router();

ndaRouter.get('/', authenticate, requireAdmin, async (req: any, res: any) => {
  const { status } = req.query;
  const where: any = {};
  if (status) where.status = status;
  const records = await prisma.ndaRecord.findMany({
    where,
    include: { member: { select: { name: true, email: true, initials: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: records });
});

ndaRouter.get('/me', authenticate, async (req: AuthRequest, res: any) => {
  const nda = await prisma.ndaRecord.findUnique({
    where: { memberId: req.user!.id },
  });
  res.json(nda ?? null);
});

ndaRouter.post('/sign', authenticate, async (req: AuthRequest, res: any) => {
  const nda = await prisma.ndaRecord.upsert({
    where: { memberId: req.user!.id },
    update: { status: 'SIGNED', signedAt: new Date() },
    create: {
      memberId: req.user!.id,
      status: 'SIGNED',
      signedAt: new Date(),
      version: '1.0',
      expiresAt: new Date(Date.now() + 365 * 86400_000),
    },
  });
  res.json(nda);
});

export { ndaRouter };

// ─── Export par défaut pour chaque router ─────────────────────────────────────
export default usersRouter;
