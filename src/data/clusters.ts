// ─── clusters.ts ─────────────────────────────────────────────────────────────
// Source unique de vérité pour les 15 clusters CGIF et leurs 64 spécialisations
// Importé par : RegisterPage.tsx, seed.ts, et tout composant qui en a besoin

export interface Specialization {
  id: string;
  name: string;
}

export interface Cluster {
  id: string;
  code: string;           // E1-E10 / C1-C5
  name: string;
  domain: string;         // engineering | health | business | education | arts | law
  specializations: Specialization[];
}

export const CLUSTERS: Cluster[] = [

  // ── ENGINEERING ──────────────────────────────────────────────────────────

  {
    id: 'cluster-e1',
    code: 'E1',
    name: 'Mechanical & Manufacturing Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e1-mec',  name: 'Mechanical Engineering' },
      { id: 'e1-mct',  name: 'Mechatronics Engineering' },
      { id: 'e1-rob',  name: 'Robotics Engineering' },
      { id: 'e1-the',  name: 'Thermal Engineering' },
      { id: 'e1-pro',  name: 'Production Engineering' },
      { id: 'e1-mai',  name: 'Maintenance Engineering' },
    ],
  },

  {
    id: 'cluster-e2',
    code: 'E2',
    name: 'Electrical, Electronic & Communication Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e2-ele',  name: 'Electrical Engineering' },
      { id: 'e2-mic',  name: 'Microelectronic Engineering' },
      { id: 'e2-tel',  name: 'Telecommunications Engineering' },
      { id: 'e2-aut',  name: 'Automation Engineering' },
      { id: 'e2-opt',  name: 'Optical Engineering' },
      { id: 'e2-pho',  name: 'Photonics Engineering' },
    ],
  },

  {
    id: 'cluster-e3',
    code: 'E3',
    name: 'Computer & Digital Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e3-cmp',  name: 'Computer Engineering' },
      { id: 'e3-sft',  name: 'Software Engineering' },
      { id: 'e3-dat',  name: 'Data Engineering' },
      { id: 'e3-ai',   name: 'Artificial Intelligence Engineering' },
      { id: 'e3-sys',  name: 'Systems Engineering' },
    ],
  },

  {
    id: 'cluster-e4',
    code: 'E4',
    name: 'Civil, Infrastructure & Environmental Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e4-civ',  name: 'Civil Engineering' },
      { id: 'e4-con',  name: 'Construction Engineering' },
      { id: 'e4-hyd',  name: 'Hydraulic Engineering' },
      { id: 'e4-tra',  name: 'Transportation Engineering' },
      { id: 'e4-geo',  name: 'Geomatics Engineering' },
    ],
  },

  {
    id: 'cluster-e5',
    code: 'E5',
    name: 'Chemical & Process Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e5-che',  name: 'Chemical Engineering' },
      { id: 'e5-prc',  name: 'Process Engineering' },
      { id: 'e5-foo',  name: 'Food Engineering' },
      { id: 'e5-tex',  name: 'Textile Engineering' },
    ],
  },

  {
    id: 'cluster-e6',
    code: 'E6',
    name: 'Natural Resources & Energy Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e6-min',  name: 'Mining Engineering' },
      { id: 'e6-pet',  name: 'Petroleum Engineering' },
      { id: 'e6-for',  name: 'Forest Engineering' },
      { id: 'e6-agr',  name: 'Agricultural Engineering' },
      { id: 'e6-glg',  name: 'Geological Engineering' },
      { id: 'e6-ene',  name: 'Energy Engineering' },
      { id: 'e6-nuc',  name: 'Nuclear Engineering' },
    ],
  },

  {
    id: 'cluster-e7',
    code: 'E7',
    name: 'Aerospace, Marine & Transport Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e7-aer',  name: 'Aerospace Engineering' },
      { id: 'e7-spa',  name: 'Space Engineering' },
      { id: 'e7-mar',  name: 'Marine Engineering' },
      { id: 'e7-nav',  name: 'Naval Engineering' },
    ],
  },

  {
    id: 'cluster-e8',
    code: 'E8',
    name: 'Materials & Advanced Technology Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e8-mat',  name: 'Materials Engineering' },
      { id: 'e8-nan',  name: 'Nanotechnology Engineering' },
    ],
  },

  {
    id: 'cluster-e9',
    code: 'E9',
    name: 'Industrial & Systems Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e9-ind',  name: 'Industrial Engineering' },
      { id: 'e9-log',  name: 'Logistics Engineering' },
    ],
  },

  {
    id: 'cluster-e10',
    code: 'E10',
    name: 'Health & Environmental Engineering',
    domain: 'engineering',
    specializations: [
      { id: 'e10-bio', name: 'Biomedical Engineering' },
      { id: 'e10-env', name: 'Environmental Engineering' },
      { id: 'e10-aco', name: 'Acoustical Engineering' },
    ],
  },

  // ── OTHER DISCIPLINES ─────────────────────────────────────────────────────

  {
    id: 'cluster-c1',
    code: 'C1',
    name: 'Health Sciences',
    domain: 'health',
    specializations: [
      { id: 'c1-med',  name: 'Medicine' },
      { id: 'c1-pha',  name: 'Pharmacy' },
      { id: 'c1-den',  name: 'Dentistry' },
      { id: 'c1-nur',  name: 'Nursing' },
      { id: 'c1-pub',  name: 'Public Health' },
      { id: 'c1-nut',  name: 'Nutrition' },
    ],
  },

  {
    id: 'cluster-c2',
    code: 'C2',
    name: 'Business, Economics & Management',
    domain: 'business',
    specializations: [
      { id: 'c2-bus',  name: 'Business Administration' },
      { id: 'c2-fin',  name: 'Finance' },
      { id: 'c2-mkt',  name: 'Marketing' },
      { id: 'c2-acc',  name: 'Accounting' },
      { id: 'c2-ent',  name: 'Entrepreneurship' },
      { id: 'c2-ops',  name: 'Operations Management' },
    ],
  },

  {
    id: 'cluster-c3',
    code: 'C3',
    name: 'Education & Learning Sciences',
    domain: 'education',
    specializations: [
      { id: 'c3-edu',  name: 'Education' },
      { id: 'c3-ped',  name: 'Pedagogy' },
      { id: 'c3-did',  name: 'Didactics' },
    ],
  },

  {
    id: 'cluster-c4',
    code: 'C4',
    name: 'Arts, Design & Creative Industries',
    domain: 'arts',
    specializations: [
      { id: 'c4-des',  name: 'Design' },
      { id: 'c4-arc',  name: 'Architecture' },
    ],
  },

  {
    id: 'cluster-c5',
    code: 'C5',
    name: 'Droit & Gouvernance',
    domain: 'law',
    specializations: [
      { id: 'c5-dro',  name: 'Droit' },
      { id: 'c5-rel',  name: 'Relations internationales' },
      { id: 'c5-adm',  name: 'Administration publique' },
    ],
  },
];

// Helpers
export const getClusterById = (id: string) => CLUSTERS.find(c => c.id === id);
export const getSpecsByClusterId = (clusterId: string) =>
  CLUSTERS.find(c => c.id === clusterId)?.specializations ?? [];

export default CLUSTERS;
