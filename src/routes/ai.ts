// ─── src/routes/ai.ts ─────────────────────────────────────────────────────────
// Routes IA CGIF — propulsées par Claude (Anthropic)
// Fonctionnalités : classification docs, analyse news, assistant IA

import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';

const router = Router();

// ── Helper : appel à l'API Claude ────────────────────────────────────────────
async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 1000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error: ${err}`);
  }

  const data = await response.json() as any;
  return data.content[0].text as string;
}

// Helper JSON Claude
async function callClaudeJSON(systemPrompt: string, userMessage: string, maxTokens = 1000) {
  const text = await callClaude(
    systemPrompt + '\n\nRéponds UNIQUEMENT en JSON valide, sans markdown ni backticks.',
    userMessage,
    maxTokens
  );
  try {
    return JSON.parse(text.trim());
  } catch {
    // Essayer d'extraire le JSON du texte
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Réponse Claude non JSON: ' + text.slice(0, 200));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. ASSISTANT CGIF — Chat intelligent
// POST /api/v1/ai/chat
// ══════════════════════════════════════════════════════════════════════════════
router.post('/chat', authenticate, [
  body('message').trim().isLength({ min: 2, max: 2000 }),
  body('history').optional().isArray(),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { message, history = [] } = req.body;
  const user = req.user!;

  try {
    const systemPrompt = `Tu es l'assistant intelligent de CGIF (Cameroon Global Intelligence Forum), une plateforme d'investissement et de collaboration pour la diaspora camerounaise.

Ton rôle :
- Aider les membres à comprendre les projets d'investissement
- Expliquer le fonctionnement de la plateforme (KYC, NDA, parts, dividendes)
- Donner des informations sur les clusters (Santé, Finance, Éducation, Énergie, Tech, Agro)
- Expliquer les aspects juridiques OHADA liés aux investissements
- Répondre en français professionnel

Contexte utilisateur : ${user.role === 'ADMIN' ? 'Administrateur CGIF' : 'Membre CGIF'}

Règles :
- Tu ne donnes pas de conseils financiers personnalisés
- Tu restes dans le périmètre CGIF
- Tu es concis mais complet (max 3 paragraphes)
- Tu peux utiliser des emojis avec modération`;

    const messages = [
      ...history.slice(-6).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json() as any;
    const reply = data.content[0].text;

    res.json({ reply, role: 'assistant' });
  } catch (err: any) {
    console.error('AI Chat error:', err);
    res.status(500).json({ error: 'Erreur assistant IA' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. CLASSIFICATION DOCUMENT IA
// POST /api/v1/ai/classify-document
// ══════════════════════════════════════════════════════════════════════════════
router.post('/classify-document', authenticate, requireAdmin, [
  body('documentId').notEmpty(),
  body('documentName').notEmpty(),
  body('documentContent').optional().trim(),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { documentId, documentName, documentContent } = req.body;

  try {
    const result = await callClaudeJSON(
      `Tu es un expert en classification de documents pour CGIF (Cameroon Global Intelligence Forum).
Les catégories possibles sont :
- "Étude de faisabilité" : analyses de viabilité de projets
- "Budget prévisionnel" : plans financiers et prévisionnels  
- "Protocole médical" : procédures et protocoles de soins
- "Cahier des charges" : spécifications techniques
- "Accord de partenariat" : lettres d'intention, MOU, partenariats
- "Étude d'impact environnemental" : EIE, analyses environnementales
- "Spécifications techniques" : specs matérielles ou logicielles
- "Contrat provisoire" : projets de contrats, brouillons
- "Rapport final de clôture" : rapports de fin de projet
- "NDA / Accord de confidentialité" : accords de non-divulgation
- "Document financier" : bilans, comptes de résultat
- "Autre" : tout ce qui ne rentre pas dans les autres catégories`,

      `Classifie ce document CGIF et retourne un JSON avec ces champs exactement :
{
  "aiTag": "catégorie du document",
  "aiConf": 0.95,
  "aiSummary": "résumé en 1-2 phrases maximum",
  "suggestedCluster": "Santé & Médecine|Finance & Investissement|Éducation & Formation|Énergie & Environnement|Numérique & Tech|Agro-alimentaire|null"
}

Nom du fichier : ${documentName}
${documentContent ? `Contenu : ${documentContent.slice(0, 2000)}` : ''}`
    );

    // Mettre à jour en BDD
    const doc = await prisma.document.update({
      where: { id: documentId },
      data: {
        aiTag: result.aiTag,
        aiConf: result.aiConf,
        aiSummary: result.aiSummary,
        status: 'CLASSIFIED',
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'DOCUMENT_CLASSIFIED_AI',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        target: documentName,
        detail: `Classifié: ${result.aiTag} (${Math.round(result.aiConf * 100)}% confiance)`,
        type: 'document',
        severity: 'info',
        entityId: documentId,
      },
    });

    res.json({ document: doc, classification: result });
  } catch (err: any) {
    console.error('AI classify error:', err);
    res.status(500).json({ error: 'Erreur classification IA' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. ANALYSE D'ACTUALITÉ IA
// POST /api/v1/ai/analyze-news
// ══════════════════════════════════════════════════════════════════════════════
router.post('/analyze-news', authenticate, requireAdmin, [
  body('titre').trim().isLength({ min: 5 }),
  body('contenu').trim().isLength({ min: 50 }),
  body('source').optional().trim(),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { titre, contenu, source } = req.body;

  try {
    const result = await callClaudeJSON(
      `Tu es un analyste spécialisé dans l'actualité africaine et camerounaise pour CGIF.
Tu évalues la pertinence des articles pour la diaspora camerounaise investissant au pays.`,

      `Analyse cet article et retourne un JSON :
{
  "resume": "résumé en 2-3 phrases pour la diaspora",
  "cluster": "Santé & Médecine|Finance & Investissement|Éducation & Formation|Énergie & Environnement|Numérique & Tech|Agro-alimentaire",
  "domaine": "santé|finance|éducation|énergie|tech|agriculture",
  "scoreIA": 0.95,
  "tags": ["tag1", "tag2", "tag3"],
  "pertinenceDiaspora": "explication en 1 phrase de pourquoi c'est pertinent pour la diaspora"
}

Titre : ${titre}
Source : ${source || 'Non précisée'}
Contenu : ${contenu.slice(0, 3000)}`,
      800
    );

    // Sauvegarder l'article analysé
    const article = await prisma.newsArticle.create({
      data: {
        titre,
        resume: result.resume,
        source: source || null,
        cluster: result.cluster,
        domaine: result.domaine,
        tags: result.tags || [],
        scoreIA: result.scoreIA || 0.8,
        image: '📰',
      },
    });

    res.json({ article, analysis: result });
  } catch (err: any) {
    console.error('AI news error:', err);
    res.status(500).json({ error: 'Erreur analyse actualité IA' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. ANALYSE DE PROJET IA
// POST /api/v1/ai/analyze-project
// ══════════════════════════════════════════════════════════════════════════════
router.post('/analyze-project', authenticate, requireAdmin, [
  body('projectId').notEmpty(),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  try {
    const project = await prisma.project.findUnique({
      where: { id: req.body.projectId },
      include: {
        cluster: true,
        documents: true,
        _count: { select: { investments: true } },
      },
    });

    if (!project) return res.status(404).json({ error: 'Projet introuvable' });

    const result = await callClaudeJSON(
      `Tu es un analyste financier expert en investissement en Afrique subsaharienne pour CGIF.
Tu analyses les projets soumis par la diaspora camerounaise.`,

      `Analyse ce projet CGIF et retourne un JSON :
{
  "scoreViabilite": 0.85,
  "risques": ["risque 1", "risque 2"],
  "opportunites": ["opportunité 1", "opportunité 2"],
  "recommandation": "APPROUVER|REVISION|REJETER",
  "justification": "explication en 2-3 phrases",
  "pointsAttention": ["point 1", "point 2"],
  "prochainEtape": "action recommandée pour l'admin"
}

Projet :
- Titre : ${project.title}
- Cluster : ${project.cluster?.name}
- Objectif : ${project.targetAmount}M FCFA
- Statut actuel : ${project.status}
- Documents : ${project.documents.length} fichiers
- Investisseurs : ${project._count.investments}
- Description : ${project.description || 'Non fournie'}`,
      800
    );

    res.json({ project: { id: project.id, title: project.title }, analysis: result });
  } catch (err: any) {
    console.error('AI project error:', err);
    res.status(500).json({ error: 'Erreur analyse projet IA' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. GÉNÉRATION D'ANNONCE IA
// POST /api/v1/ai/generate-announcement
// ══════════════════════════════════════════════════════════════════════════════
router.post('/generate-announcement', authenticate, requireAdmin, [
  body('sujet').trim().isLength({ min: 5 }),
  body('contexte').optional().trim(),
  body('ton').optional().isIn(['formel', 'cordial', 'urgent']),
], async (req: AuthRequest, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

  const { sujet, contexte, ton = 'cordial' } = req.body;

  try {
    const result = await callClaudeJSON(
      `Tu es le responsable des communications de CGIF (Cameroon Global Intelligence Forum).
Tu rédiges des annonces professionnelles pour la communauté diaspora camerounaise.
Ton style est ${ton}, clair et engageant.`,

      `Génère une annonce CGIF et retourne un JSON :
{
  "titre": "titre accrocheur",
  "corps": "texte de l'annonce en 2-3 paragraphes",
  "priorite": "normal|high",
  "tags": ["tag1", "tag2"]
}

Sujet : ${sujet}
${contexte ? `Contexte : ${contexte}` : ''}`,
      600
    );

    res.json({ announcement: result });
  } catch (err: any) {
    console.error('AI announcement error:', err);
    res.status(500).json({ error: 'Erreur génération annonce IA' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. RAPPORT ANALYTICS IA
// GET /api/v1/ai/analytics-report
// ══════════════════════════════════════════════════════════════════════════════
router.get('/analytics-report', authenticate, requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const [users, projects, investments, kycs] = await Promise.all([
      prisma.user.count(),
      prisma.project.findMany({ include: { _count: { select: { investments: true } } } }),
      prisma.investment.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.kycRecord.groupBy({ by: ['status'], _count: true }),
    ]);

    const projectStats = projects.map(p => `${p.title}: ${p.status}, ${p._count.investments} investisseurs`).join('\n');

    const report = await callClaude(
      `Tu es un analyste financier senior pour CGIF. Tu génères des rapports exécutifs concis et pertinents pour le fondateur KJ. Yvan. Réponds en français professionnel.`,

      `Génère un rapport exécutif synthétique (max 400 mots) basé sur ces données CGIF :

MEMBRES : ${users} membres inscrits
INVESTISSEMENTS : ${investments._count} dossiers, ${(investments._sum.amount || 0).toLocaleString()} FCFA levés
PROJETS :
${projectStats}
KYC : ${kycs.map(k => `${k.status}: ${k._count}`).join(', ')}

Le rapport doit inclure :
1. Synthèse de la situation actuelle
2. Points forts du mois
3. Points d'attention
4. 2-3 recommandations stratégiques`,
      600
    );

    res.json({ report, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('AI report error:', err);
    res.status(500).json({ error: 'Erreur rapport IA' });
  }
});

export default router;
