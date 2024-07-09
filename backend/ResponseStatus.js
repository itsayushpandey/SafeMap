/**
 * @author Gehna Anand
 */
class ResponseStatus {
  constructor(code, message, desc) {
    this.code = code;
    this.message = message;
    this.desc = desc;
  }
}

module.exports = ResponseStatus;
