var sqlite3 = require('sqlite3').verbose();
//var db = new sqlite3.Database('../databases/tumbletag.db');
var errorConsole = require('./ErrorConsoleController');
var dbControllerName = "DatabaseController";

var db;

var SQL_MSG = {
  'INSERT_INTO' : "INSERT INTO",
  'CREATE_TABLE' : "CREATE TABLE",
  'SELECT' : "SELECT",
  'FROM' : 'FROM',
  'SELECT_ALL_FROM': 'SELECT * FROM',
  'VALUES' : "values",
  'DROP_TABLE_IF_EXISTS' : 'DROP TABLE IF EXISTS'
};

// Field String of the form (field_1, field2, ...) for a db nameKey;
var DB_FIELDS = {
  'users' : "(username, email, oauth_token, oauth_secret, date_created)"
} ;


function createDatabase(database){
  db = database;
  db.serialize(function() {
    //Remove when finished testing
    db.run("DROP TABLE IF EXISTS users");

    //store rooms in csv or json
    db.run("CREATE TABLE users(id INTEGER PRIMARY KEY, \
                               username TEXT, \
                               email TEXT, \
                               oauth_token TEXT,\
                               oauth_secret TEXT,\
                               date_created TEXT)");
  });
};

/*@method: insertInto
 *@params: tableName - the table to be inserted into
 *         params - an array of
 *returns: a string in the format "(?,?...,?) where a '?' is placed numParam times.
 */

function insertInto(tableName, params) {
  if (!tableName || !params) {
    errorConsole.throwError("tableName or params is undefined", "insertInto()", dbControllerName);
    return;
  }
  var paramString = getParamsString(params);

  if (!paramString) {
    errorConsole.throwError("paramString is undefined", "insertInto()", dbControllerName);
    return;
  }
  var msgData = [SQL_MSG.INSERT_INTO, tableName, DB_FIELDS[tableName], SQL_MSG.VALUES, paramString];
  var sqlMessage = getSQLMessageByAppending(msgData);

  if (sqlMessage) {
    console.log("WITH PARAMS:" + JSON.stringify(params));
    //Convert Params to an array
    var paramsArray = getInputArray(params);
    console.log(paramsArray);
    runDBMessage(sqlMessage, paramsArray);

  }
  else {
    errorConsole.throwError("sqlMessage is undefined", "insertInto()", dbControllerName);
    return;
  }


};



/*@method: getNumParams
 *@params: input - the array or JS object with a number of params
 *returns: a string in the format "(?,?...,?) where a '?' is placed numParam times.
 */

function getNumParams(data) {
  // If data is an array just use length
  var numParams = (data.length) ? data.length : 0;

  //Otherwise we need to get number via keys in the object
  if (numParams <= 0) {
    for (key in data) {
      numParams += 1;
    }
  }
  console.log("NUM_PARAMS: " + numParams);
  return numParams;
};





/*@method: getParamsString
 *@params: numParams - an int for the number of param names for the db table
 *returns: a string in the format "(?,?...,?) where a '?' is placed numParam times.
 */

function getParamsString(data) {

  if (!data) {
    errorConsole.throwError("data is undefined", "getParamsString()", dbControllerName);
    return;
  }

  var numParams = getNumParams(data);

  if (!numParams || numParams <= 0) {
    errorConsole.throwError("numParams is undefined", "getParamsString()", dbControllerName);
    return;
  }
  //Begin param string
  var paramString = "(";

  for (var i = 0; i < numParams; i++) {
    paramString +="?";
    if (i < (numParams-1)) {
      //If we are below the last number append a comma for the next '?'
      paramString += ",";
    }
  }

  //Close the param string
  paramString += ")";
  console.log("PARAM STRING: " + paramString);
  return paramString;
};



/*@method: sqlMessageByAppending
 *@params: an object containing all of the message strings  || array array containing the params in order
 *returns: a single string that appends all msgs and spaces them properly
 */
function getSQLMessageByAppending(messageDetails) {
  if (!messageDetails) {
    errorConsole.throwError("messageDetails is undefined", "getSQLMessageByAppending()", dbControllerName);
    return
  }
  var sqlMessage = "";
  for (key in messageDetails) {
    sqlMessage += messageDetails[key] + " ";
  }
  //Remove trailing space
  sqlMessage = sqlMessage.substring(0,
  sqlMessage.length-1);
  console.log("SQL COMMAND: " + sqlMessage);
  return sqlMessage;

}


/*@method: getInputArray
 *@params: an object containing all of the input params in order
 *returns: a single array containing the params in order
 */
 function getInputArray(inputParams) {
   var inputArray = [];
   for (key in inputParams) {
     inputArray.push(inputParams[key]);
   }
   return inputArray;

 }



/*@method: runDBMessage
 *@params: sqlMessage - a string representation of a sqlMessage
 *returns: a string in the format "(?,?...,?) where a '?' is placed numParam times.
 */


function runDBMessage(sqlMessage, params) {
  if (sqlMessage) {

    if(!params) {
      db.run(sqlMessage);
    }
     else {
      db.run(sqlMessage, params);

    }
    console.log("Database Run: SUCCESS");
  }
  else {
    errorConsole.throwError("SQL Message is undefined", "runDBMessage()", dbControllerName);
  }
};


//===== PUBLIC =================================================================
module.exports.createDatabase = createDatabase;
module.exports.insertInto = insertInto;
module.exports.runDBMessage = runDBMessage;
module.exports.getInputArray = getInputArray;
module.exports.database = db;

