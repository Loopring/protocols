
export class ParticipationSpec {

  private data: number;

  constructor(private specData: number) {
    this.data = specData;
  }

  public orderIndex() {
    return this.data;
  }
}
