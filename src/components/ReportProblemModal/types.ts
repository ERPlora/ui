// Public types of ReportProblemModal.

/** What the person wrote, trimmed: the page adds what goes with it (the account, the business, the screen). */
export interface ReportProblemReport {
  subject: string;
  description: string;
}

/** What the page's sending answers once the report left: the address support answers to. */
export interface ReportProblemSent {
  replyTo: string;
}

/** The page's sending: resolves once the report left, rejects with the command's error (an `ApiError`) otherwise. */
export type ReportProblemSend = (report: ReportProblemReport) => Promise<ReportProblemSent>;
