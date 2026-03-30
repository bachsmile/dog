export class CreateLawSubmissionDto {
  applicationId: string;
  formData: any;
}

export class UpdateLawSubmissionStatusDto {
  status: string; // pending, reviewed, processed, rejected
  adminNotes?: string;
}
