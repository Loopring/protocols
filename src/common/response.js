export default class Response {
  constructor(errorCode, errorMsg) {
    this.id = "1";
    this.result = null;
    this.error = {
      code: errorCode,
      message: errorMsg,
      data: null
    };
  }
}
