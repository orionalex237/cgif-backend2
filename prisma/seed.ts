// prisma/seed.ts - CGIF seed

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CGIF database...');

  // ── 1. Clusters (15 officiels E1-E10 + C1-C5) ────────────────
  const [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, c1, c2, c3, c4, c5] = await Promise.all([
    prisma.cluster.upsert({ where: { name: 'Mechanical and Manufacturing Engineering' },    update: {}, create: { code: 'E1',  name: 'Mechanical and Manufacturing Engineering',            domain: 'engineering', active: true, color: '#E53E3E', iconType: 'gear'  } }),
    prisma.cluster.upsert({ where: { name: 'Electrical, Electronic and Communication Engineering' }, update: {}, create: { code: 'E2',  name: 'Electrical, Electronic and Communication Engineering', domain: 'engineering', active: true, color: '#DD6B20', iconType: 'bolt'  } }),
    prisma.cluster.upsert({ where: { name: 'Computer and Digital Engineering' },            update: {}, create: { code: 'E3',  name: 'Computer and Digital Engineering',                   domain: 'engineering', active: true, color: '#0891B2', iconType: 'ville' } }),
    prisma.cluster.upsert({ where: { name: 'Civil, Infrastructure and Environmental Engineering' }, update: {}, create: { code: 'E4',  name: 'Civil, Infrastructure and Environmental Engineering',  domain: 'engineering', active: true, color: '#744210', iconType: 'mont'  } }),
    prisma.cluster.upsert({ where: { name: 'Chemical and Process Engineering' },            update: {}, create: { code: 'E5',  name: 'Chemical and Process Engineering',                   domain: 'engineering', active: true, color: '#6B46C1', iconType: 'foret' } }),
    prisma.cluster.upsert({ where: { name: 'Natural Resources and Energy Engineering' },    update: {}, create: { code: 'E6',  name: 'Natural Resources and Energy Engineering',            domain: 'engineering', active: true, color: '#65A30D', iconType: 'foret' } }),
    prisma.cluster.upsert({ where: { name: 'Aerospace, Marine and Transport Engineering' }, update: {}, create: { code: 'E7',  name: 'Aerospace, Marine and Transport Engineering',         domain: 'engineering', active: true, color: '#2563EB', iconType: 'ville' } }),
    prisma.cluster.upsert({ where: { name: 'Materials and Advanced Technology Engineering' }, update: {}, create: { code: 'E8', name: 'Materials and Advanced Technology Engineering',      domain: 'engineering', active: true, color: '#0F766E', iconType: 'ville' } }),
    prisma.cluster.upsert({ where: { name: 'Industrial and Systems Engineering' },          update: {}, create: { code: 'E9',  name: 'Industrial and Systems Engineering',                 domain: 'engineering', active: true, color: '#B45309', iconType: 'gear'  } }),
    prisma.cluster.upsert({ where: { name: 'Health and Environmental Engineering' },        update: {}, create: { code: 'E10', name: 'Health and Environmental Engineering',                domain: 'engineering', active: true, color: '#13883C', iconType: 'foret' } }),
    prisma.cluster.upsert({ where: { name: 'Health Sciences' },                             update: {}, create: { code: 'C1',  name: 'Health Sciences',                                    domain: 'health',      active: true, color: '#DC2626', iconType: 'foret' } }),
    prisma.cluster.upsert({ where: { name: 'Business, Economics and Management' },          update: {}, create: { code: 'C2',  name: 'Business, Economics and Management',                 domain: 'finance',     active: true, color: '#C8821A', iconType: 'mont'  } }),
    prisma.cluster.upsert({ where: { name: 'Education and Learning Sciences' },             update: {}, create: { code: 'C3',  name: 'Education and Learning Sciences',                    domain: 'education',   active: true, color: '#7C3AED', iconType: 'ville' } }),
prisma.cluster.upsert({ where: { name: 'Arts, Design and Creative Industries' },        update: {}, create: { code: 'C4',  name: 'Arts, Design and Creative Industries',               domain: 'arts',        active: true, color: '#DB2777', iconType: 'ville' } }),
    prisma.cluster.upsert({ where: { name: 'Law and Governance' },                          update: {}, create: { code: 'C5',  name: 'Law and Governance',                                 domain: 'law',         active: true, color: '#475569', iconType: 'mont'  } }),
  ]);

  console.log('[OK] 15 clusters crees (E1-E10 + C1-C5)');

  // ── 2. Utilisateurs ───────────────────────────────────────────
  const adminHash  = await bcrypt.hash(process.env.ADMIN_PASSWORD  || 'Admin@CGIF2024!',  12);
  const memberHash = await bcrypt.hash(process.env.MEMBER_PASSWORD || 'Member@CGIF2024!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'yvan@cgif.cm' }, update: {},
    create: {
      email: 'yvan@cgif.cm', passwordHash: adminHash,
      name: 'Yvan Kamga', initials: 'YK',
      role: 'ADMIN', status: 'ACTIVE', kycStatus: 'APPROVED',
      country: 'France', city: 'Paris',
      domain: 'finance', clusterId: c2.id,
    },
  });

  const amina = await prisma.user.upsert({
    where: { email: 'amina@cgif.cm' }, update: {},
    create: {
      email: 'amina@cgif.cm', passwordHash: memberHash,
      name: 'Amina Bello', initials: 'AB',
      role: 'MEMBER', status: 'ACTIVE', kycStatus: 'APPROVED',
      country: 'Canada', city: 'Montreal',
      domain: 'health', clusterId: c1.id,
    },
  });

  const paul = await prisma.user.upsert({
    where: { email: 'paul@cgif.cm' }, update: {},
    create: {
      email: 'paul@cgif.cm', passwordHash: memberHash,
      name: 'Paul Essomba', initials: 'PE',
      role: 'MEMBER', status: 'ACTIVE', kycStatus: 'PENDING',
      country: 'Allemagne', city: 'Berlin',
      domain: 'tech', clusterId: e3.id,
    },
  });

  console.log('[OK] 3 utilisateurs crees (admin + 2 membres)');

  // ── 3. KYC Amina ──────────────────────────────────────────────
  await prisma.kycRecord.upsert({
    where: { memberId: amina.id }, update: {},
    create: {
      memberId: amina.id, status: 'APPROVED',
      nom: 'Bello', prenom: 'Amina',
      dateNaissance: '1990-04-12', nationalite: 'Camerounaise',
      adresse: '12 rue Laurier, Montreal',
      docType: 'passport', proofType: 'facture',
      reviewedById: admin.id, reviewedAt: new Date(),
    },
  });

  // ── 4. Projets ────────────────────────────────────────────────
  const projet1 = await prisma.project.upsert({
    where: { id: 'proj-clinique-001' }, update: {},
    create: {
      id: 'proj-clinique-001',
      title: 'Clinique Specialisee Yaounde',
      description: 'Construction une clinique specialisee en cardiologie et chirurgie a Yaounde.',
      status: 'FUNDING',
      targetAmount: 150_000_000, sharePrice: 5000,
      collectedAmount: 48_500_000, progress: 32,
      fundingDeadline: new Date('2025-09-30'),
      category: 'Sante', location: 'Yaounde, Cameroun',
      returnRate: 8.5, duration: '5 ans',
      clusterId: c1.id, submitterId: admin.id, analystId: admin.id,
    },
  });

  await prisma.project.upsert({
    where: { id: 'proj-fintech-001' }, update: {},
    create: {
      id: 'proj-fintech-001',
      title: 'FinTech OHADA Platform',
      description: 'Plateforme fintech conforme aux normes OHADA.',
      status: 'REVIEW',
      targetAmount: 75_000_000, sharePrice: 5000,
      collectedAmount: 0, progress: 0,
      category: 'Finance', location: 'Douala, Cameroun',
      returnRate: 12, duration: '3 ans',
      clusterId: c2.id, submitterId: amina.id,
    },
  });

  await prisma.project.upsert({
    where: { id: 'proj-solar-001' }, update: {},
    create: {
id: 'proj-solar-001',
      title: 'SolarVille - Villages Solaires',
      description: 'Installation de micro-reseaux solaires dans 15 villages ruraux du Grand Nord Cameroun.',
      status: 'FUNDED',
      targetAmount: 200_000_000, sharePrice: 5000,
      collectedAmount: 200_000_000, progress: 100,
      category: 'Energie', location: 'Maroua, Cameroun',
      returnRate: 7, duration: '7 ans',
      clusterId: e6.id, submitterId: admin.id, analystId: admin.id,
    },
  });

  console.log('[OK] 3 projets crees');

  // ── 5. Investissement demo ────────────────────────────────────
  const existInv = await prisma.investment.findFirst({
    where: { memberId: amina.id, projectId: projet1.id },
  });
  if (!existInv) {
    await prisma.investment.create({
      data: {
        memberId: amina.id, projectId: projet1.id,
        amount: 500_000, sharePrice: 5000, sharesCount: 100,
        paymentMethod: 'VIREMENT_SEPA', status: 'ACTIVE',
        refVirement: 'CGIF-0001-AMIN-' + Date.now().toString(36).toUpperCase(),
        memberNom: 'Bello', memberPrenom: 'Amina',
        activatedAt: new Date(Date.now() - 3 * 86400_000),
      },
    });
  }

  // ── 6. Notifications demo ─────────────────────────────────────
  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      { userId: amina.id, type: 'success', icon: 'check', title: 'KYC valide',            message: 'Votre identite a ete verifiee.', entityType: 'kyc' },
      { userId: amina.id, type: 'info',    icon: 'brief', title: 'Investissement active', message: '100 parts activees dans Clinique Specialisee Yaounde', entityType: 'investment' },
      { userId: paul.id,  type: 'info',    icon: 'id',    title: 'KYC en attente',        message: 'Votre dossier KYC est en cours examen.', entityType: 'kyc' },
    ],
  });

  // ── 7. Annonce ────────────────────────────────────────────────
  await prisma.announcement.upsert({
    where: { id: 'ann-welcome-001' }, update: {},
    create: {
      id: 'ann-welcome-001',
      title: 'Bienvenue sur CGIF',
      body: 'La plateforme CGIF est en ligne. Completez votre KYC pour acceder aux projets.',
      scope: 'all', priority: 'high', status: 'published',
      authorId: admin.id,
    },
  });

  // ── 8. Audit log ──────────────────────────────────────────────
  await prisma.auditLog.create({
    data: { action: 'SEED_COMPLETED', actorRole: 'SYSTEM', target: 'Database', type: 'system', severity: 'info' },
  });

  console.log('');
  console.log('[OK] Seed termine avec succes !');
  console.log('-------------------------------------------------');
  console.log(' Admin  : yvan@cgif.cm   / $ADMIN_PASSWORD');
  console.log(' Membre : amina@cgif.cm  / $MEMBER_PASSWORD');
  console.log(' Paul   : paul@cgif.cm   / $MEMBER_PASSWORD');
  console.log('-------------------------------------------------');
  console.log(' /!\\ Changer les mots de passe en production !');
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
