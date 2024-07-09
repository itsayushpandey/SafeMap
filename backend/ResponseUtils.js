/**
 * @author Gehna Anand
 */
const ResponseStatus = require("./ResponseStatus");
const Response = require("./Response");

class ResponseUtils {
  static setResponseError(res, code, errorDesc) {
    console.log("Error:", code);
    let errorMsg;
    if (code == 400) errorMsg = "Bad request";
    else errorMsg = "Internal Server Error";

    const responseStatus = new ResponseStatus(code, errorMsg, errorDesc);
    const response = new Response(null, responseStatus);

    ResponseUtils.removeNull(response);
    res.status(code).json(response);
  }

  static removeNull(obj) {
    Object.keys(obj).forEach((key) => {
      if (obj[key] == null) {
        delete obj[key];
      } else if (typeof obj[key] == "object") {
        ResponseUtils.removeNull(obj[key]);
      }
    });
  }
}

module.exports = ResponseUtils;
