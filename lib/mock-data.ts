/**
 * Anciennes données « veille réglementaire » supprimées.
 * Fichier conservé pour compatibilité minimale (ex. notifications vides).
 */
export const mockAlertEvents: {
  id: string;
  subject: string;
  content: string;
  status: string;
  readAt?: Date;
}[] = [];

export function isMockDataEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_USE_MOCK_DATA?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export const mockAdmissionsOverview = {
  preRegistrationsTotal: 182,
  preRegistrationsSubmitted: 63,
  preRegistrationsValidated: 101,
  applicationsTotal: 149,
  applicationsSubmitted: 42,
  applicationsValidated: 88,
};

export const mockSchoolKpis = {
  studentsTotal: 3654,
  teachersTotal: 284,
  parentsTotal: 3110,
  classroomsTotal: 82,
  activeEnrollments: 3498,
  gradesCount: 12420,
  absencesCount: 306,
  justifiedAbsences: 241,
  absenceJustificationRate: 78.76,
};

export const mockNotifications = [
  {
    id: 'notif_1',
    title: 'Performance en mathematiques',
    message: 'Le resultat de Shawn est sous le seuil attendu cette semaine.',
    channel: 'email',
    status: 'sent',
    recipientEmail: 'parent.shawn@example.com',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'notif_2',
    title: 'Absence enregistree',
    message: 'Une absence non justifiee a ete signalee pour George.',
    channel: 'in_app',
    status: 'pending',
    recipientEmail: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'notif_3',
    title: 'Nouveau dossier candidat',
    message: 'La candidature de Sylvia a ete soumise et attend validation.',
    channel: 'email',
    status: 'sent',
    recipientEmail: 'service.admissions@example.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
];

export const mockStudents = [
  {
    id: 'stu_001',
    matricule: 'ESMT-STU-001',
    firstName: 'George',
    lastName: 'Odell',
    email: 'george.odell@example.com',
    phone: '+221770000001',
    dateOfBirth: '2008-04-14',
    gender: 'male',
    status: 'active',
    classroom: { id: 'cls_01', name: 'II-A', level: 'II', section: 'A' },
    parents: [
      {
        id: 'par_001',
        firstName: 'Maria',
        lastName: 'Odell',
        email: 'maria.odell@example.com',
        phone: '+221770001001',
        relation: 'Mother',
      },
    ],
  },
  {
    id: 'stu_002',
    matricule: 'ESMT-STU-002',
    firstName: 'Tenesa',
    lastName: 'Lary',
    email: 'tenesa.lary@example.com',
    phone: '+221770000002',
    dateOfBirth: '2009-01-03',
    gender: 'female',
    status: 'active',
    classroom: { id: 'cls_02', name: 'II-B', level: 'II', section: 'B' },
    parents: [],
  },
];

export const mockTeachers = [
  {
    id: 'tea_001',
    matricule: 'ESMT-TEA-001',
    firstName: 'Rubell',
    lastName: 'Kane',
    email: 'rubell.kane@example.com',
    phone: '+221780000001',
    specialty: 'Physics',
    status: 'active',
  },
  {
    id: 'tea_002',
    matricule: 'ESMT-TEA-002',
    firstName: 'Elisa',
    lastName: 'Moore',
    email: 'elisa.moore@example.com',
    phone: '+221780000002',
    specialty: 'English',
    status: 'active',
  },
];

export const mockParents = [
  {
    id: 'par_001',
    firstName: 'Maria',
    lastName: 'Odell',
    email: 'maria.odell@example.com',
    phone: '+221770001001',
    profession: 'Engineer',
    address: 'Dakar',
    studentsCount: 1,
  },
  {
    id: 'par_002',
    firstName: 'Justin',
    lastName: 'Lee',
    email: 'justin.lee@example.com',
    phone: '+221770001002',
    profession: 'Banker',
    address: 'Thiess',
    studentsCount: 2,
  },
];

export const mockClassrooms = [
  { id: 'cls_01', name: 'II-A', level: 'II', section: 'A', capacity: 32, building: 'Bloc A' },
  { id: 'cls_02', name: 'II-B', level: 'II', section: 'B', capacity: 30, building: 'Bloc A' },
  { id: 'cls_03', name: 'III-A', level: 'III', section: 'A', capacity: 28, building: 'Bloc B' },
];

export const mockPreRegistrations = [
  {
    id: 'pre_001',
    firstName: 'Awa',
    lastName: 'Ndiaye',
    email: 'awa.ndiaye@example.com',
    phone: '+221760001001',
    program: 'Telecoms',
    academicYear: '2026-2027',
    status: 'submitted',
    motivation: 'Passionnee par les reseaux.',
    reviewComment: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    documentsCount: 2,
  },
];

export const mockApplications = [
  {
    id: 'app_001',
    type: 'student',
    firstName: 'Moussa',
    lastName: 'Diallo',
    email: 'moussa.diallo@example.com',
    phone: '+221760001002',
    targetProgram: 'Data & IA',
    specialty: null,
    coverLetter: 'Je souhaite integrer ESMT pour devenir data scientist.',
    academicYear: '2026-2027',
    status: 'under_review',
    reviewComment: null,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    documentsCount: 3,
  },
];

export const mockAdmissionDocuments = [
  {
    id: 'doc_001',
    fileName: 'bac-releve-notes.pdf',
    fileUrl: 'https://example.com/docs/bac-releve-notes.pdf',
    contentType: 'application/pdf',
    fileSize: 241200,
    preRegistrationId: 'pre_001',
    applicationId: null,
    uploadedAt: new Date().toISOString(),
  },
];
