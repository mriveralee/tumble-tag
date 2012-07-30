/* Error Console Controller
 *
 *  Simple console controller for logging errors with detail
 *
 */


function throwError(message, methodName, controllerName, type) {
  if (message && controllerName && methodName) {
    var typeMessage = (type) ? type.toUpperCase() + " ERROR:" : "ERROR";
    var controllerMessage = controllerName.toUpperCase() + " >> ";
    var locationMessage = " in method:  " + methodName;
    var errorMessage = controllerMessage + typeMessage + message + locationMessage;
    console.log(errorMessage);
  }
  else {
    console.log("ERROR: " + message);
  }

};





module.exports.throwError = throwError;
