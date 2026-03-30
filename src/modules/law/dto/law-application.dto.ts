export class CreateLawApplicationDto {
  title: string;
  content: string;
  type?: string;
  config?: any;
  documentBody?: string;
}

export class UpdateLawApplicationDto {
  title?: string;
  content?: string;
  type?: string;
  config?: any;
  documentBody?: string;
}
