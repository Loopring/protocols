
export class EncodeSpec {

  private data: number[];

  constructor(private specData: number[]) {
    this.data = specData;
  }

  public orderSpecSize() {
    return this.data[0];
  }

  public ringSpecSize() {
    return this.data[1];
  }

  public addressListSize() {
    return this.data[2];
  }

  public uintListSize() {
    return this.data[3];
  }

  public uint16ListSize() {
    return this.data[4];
  }

  public bytesListSize() {
    return this.data[5];
  }

  public ringSpecSizeArray() {
    const arrayLen = this.data[1];
    const sizeArray: number[] = [];
    for (let i = 0; i < arrayLen; i++) {
      sizeArray.push(this.data[6 + i]);
    }
    return sizeArray;
  }

  public ringSpecSizeI(i: number) {
    const ringSize = this.ringSpecSize();
    assert(i < ringSize);
    return this.data[6 + i];
  }

  public ringSpecsDataLen() {
    const arrayLen = this.ringSpecSize();
    let dataLen = 0;
    for (let i = 0; i < arrayLen; i++) {
      dataLen += this.ringSpecSizeI(i);
    }
    return dataLen;
  }

  public bytesListSizeArray() {
    const ringSpecLength = this.ringSpecSize();
    const listSize = this.bytesListSize();
    const sizeArray: number[] = [];
    for (let i = 0; i < listSize; i++) {
      sizeArray.push(this.data[6 + ringSpecLength + i]);
    }
    return sizeArray;
  }
}
