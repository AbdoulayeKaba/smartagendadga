export class ReportDuplicateError extends Error {
  readonly code = 'DUPLICATE_TITLE' as const;

  constructor() {
    super('Un compte rendu avec ce titre existe déjà.');
    this.name = 'ReportDuplicateError';
  }
}
