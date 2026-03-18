export class CreateLawApplicationDto {
  title: string;
  content: string;
  type?: string;
  config?: any;
}

export class UpdateLawApplicationDto {
  title?: string;
  content?: string;
  type?: string;
  config?: any;
}
