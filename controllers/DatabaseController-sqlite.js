var sqlite3 = require('sqlite3').verbose();
//var sqlite3 = {};
//var db = new sqlite3.Database('../databases/tumbletag.db');
var errorConsole = require('./ErrorConsoleController');
var dbControllerName = "DatabaseController";

var db;

var SQL_MSG = {
  'INSERT_INTO' : "INSERT INTO",
  'UPDATE' : "UPDATE",
  'WHERE' : "WHERE",
  'SET' : 'SET',
  'CREATE_TABLE' : "CREATE TABLE",
  'SELECT' : "SELECT",
  'FROM' : 'FROM',
  'SELECT_ALL_FROM': 'SELECT * FROM',
  'VALUES' : "values",
  'DROP_TABLE_IF_EXISTS' : 'DROP TABLE IF EXISTS',
  'SINGLE_QUOTE' : '\"',
  'AND' : 'AND'
};

// Field String of the form (field_1, field_2, ...) for a db nameKey;
var DB_FIELDS = {
  'users' : "(id, username, email, oauth_token, oauth_secret, confirmation_key, confirmed, date_created, timestamp_last_tagged)"
};


function createDatabase(database){ 
  db = database;
  if (db) {
    db.serialize(function() {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", function(error, row) {
            var tableExists = (row != undefined);
            if(!tableExists) {
                //Create the users table
                db.run("CREATE TABLE users(id INTEGER, \
                                           username TEXT PRIMARY KEY, \
                                           email TEXT, \
                                           oauth_token TEXT,\
                                           oauth_secret TEXT,\
                                           confirmation_key TEXT,\
                                           confirmed INTEGER,\
                                           date_created INTEGER,\
                                           timestamp_last_tagged INTEGER)");
                                            /*    db.run("CREATE TABLE users(id INTEGER PRIMARY KEY, \
                                           username TEXT , \
                                           email TEXT, \
                                           oauth_token TEXT,\
                                           oauth_secret TEXT,\
                                           confirmation_key TEXT,\
                                           confirmed INTEGER,\
                                           date_created TEXT)");*/
                                           
               console.log("Users Table Created");
              }
              else {
                  //Do Nothing
                  console.log("Users Table Already Exists");
              }
             
        });
    });
  }
}

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
    //console.log(sqlMessage);
  if (sqlMessage) {
    //console.log("WITH PARAMS:" + JSON.stringify(params));
    //Convert Params to an array
    var paramsArray = getInputArray(params);
    //console.log(paramsArray);
    return runDBMessage(sqlMessage, paramsArray);

  }
  else {
    errorConsole.throwError("sqlMessage is undefined", "insertInto()", dbControllerName);
    return;
  }
}


/*@method: update
 *@params: tableName - the table to be inserted into
 *         setParams- js object containing keys/values for the cols to be update.
 *         whereParams - js object containing keys/values for the cols that should
 *                       be updates
 */

function update(tableName, setParams, whereParams, callback ) {
  if (!tableName || !setParams) {
    errorConsole.throwError("tableName or params is undefined", "update()", dbControllerName);
    return;
  }
  var setFields = getSetFields(setParams);
  var whereFields = getWhereFields(whereParams);

  //console.log("SET FIELDS:" + setFields);
  //console.log("WHERE FIELDS:" + whereFields);

  if (!setFields) {
    errorConsole.throwError("setFields is undefined", "update()", dbControllerName);
    return;
  }
  var msgData = [SQL_MSG.UPDATE, tableName, setFields, whereFields];
  var sqlMessage = getSQLMessageByAppending(msgData);

  if (sqlMessage) {
    return runDBMessage(sqlMessage, [], callback);
  }
  else {
    errorConsole.throwError("sqlMessage is undefined", "update()", dbControllerName);
    return;
  }
}




/*@method: selectAllFrom
 *@params: tableName - the table to be inserted into
 *         whereParams - js object containing keys/values for the cols that should
 *                       be selected
 */

function selectAllFrom(tableName, whereParams, callback) {
  if (!tableName || !whereParams) {
    errorConsole.throwError("tableName or params is undefined", "update()", dbControllerName);
    return;
  }
  //If "ALL" where just select all
  var whereFields = "";
  if (whereParams === "ALL") {
      whereFields = ""
  }
  else if (whereParams) {
      whereFields = getWhereFields(whereParams);
  }
  
  //console.log("WHERE FIELDS:" + whereFields);
  var msgData = [SQL_MSG.SELECT_ALL_FROM, tableName, whereFields];
  var sqlMessage = getSQLMessageByAppending(msgData);

  if (sqlMessage) {
      return eachDBMessage(sqlMessage, [], callback);
  }
  else {
    errorConsole.throwError("sqlMessage is undefined", "select()", dbControllerName);
    return;
  }
}


/*@method: select
 *@params: tableName - the table to be inserted into
 *         whereParams - js object containing keys/values for the cols that should
 *                       selected
 */

function selectFrom(tableName, whereParams, callback) {
  if (!tableName || !whereParams) {
    errorConsole.throwError("tableName or params is undefined", "update()", dbControllerName);
    return;
  }
  var whereFields = getWhereFields(whereParams);
  //console.log("WHERE FIELDS:" + whereFields);

  var msgData = [SQL_MSG.SELECT, tableName, whereFields];
  var sqlMessage = getSQLMessageByAppending(msgData);

  if (sqlMessage) {
    return getDBMessage(sqlMessage, [], callback);
  }
  else {
    errorConsole.throwError("sqlMessage is undefined", "select()", dbControllerName);
    return;
  }
}






/*@method: getSetFields
 *@params: setParams- a JS object of a key:value where the key is the column name and its value
  *                   representing the value to set at the corresponding column name.
 *returns: a string of the form: "SET paramName= paramValue, ...."
 */

function getSetFields(setParams) {
  if (setParams) {
    var setMessage = SQL_MSG.SET + " ";
    var quote = SQL_MSG.SINGLE_QUOTE;
    for (key in setParams) {
      setMessage += key + "=" + quote + setParams[key] + quote + ", ";
    }
    //Remove trailing comma
    setMessage = setMessage.substring(0, setMessage.length-2);
    return setMessage;
  }
  else {
    errorConsole.throwError('setParams is undefined', "getSetFields()", dbControllerName);
    return;
  }
}


/*@method: getWhereFields
 *@params: whereParams- a JS object of a key:value where the key is the column name and its value
 *                   representing the value to set at the corresponding column name.
 *          options- an array defining the AND | OR etc for each where params -> NOT USED YET
 *returns: a string of the form: "WHERE paramName = paramValue, ...."
 */

function getWhereFields(whereParams, options) {
  if (whereParams) {
    var whereMessage = SQL_MSG.WHERE + " ";
    var quote = SQL_MSG.SINGLE_QUOTE;
    for (key in whereParams) {
     var andMessage = " " + SQL_MSG.AND + " ";
      whereMessage += key + "=" + quote + whereParams[key] + quote + andMessage;
    }
    //Remove trailing 'AND' & space
    whereMessage = whereMessage.substring(0, whereMessage.length-5);
    return whereMessage;
  }
  else {
    errorConsole.throwError('whereParams is undefined', "getWhereFields()", dbControllerName);
    return;
  }
}




/*@method: runDBMessage
 *@params: sqlMessage - a string representation of a sqlMessage
 *returns: a string in the format "(?,?...,?) where a '?' is placed numParam times.
 */


function runDBMessage(sqlMessage, params, callback) {
  if (sqlMessage) {
      //console.log("Database - RUN: SUCCESS");
      return db.run(sqlMessage, params, callback);
      
  }
  else {
    errorConsole.throwError("SQL Message is undefined", "runDBMessage()", dbControllerName);
  }
}


function getDBMessage(sqlMessage, params, callback) {
  if (sqlMessage) {
    //console.log("Database - GET: SUCCESS");
    if(!params) {
      return db.get(sqlMessage, [], callback);
    }
    else {
      return db.get(sqlMessage, params, callback);

    }
    
  }
  else {
    errorConsole.throwError("SQL Message is undefined", "getDBMessage()", dbControllerName);
  }
}

function allDBMessage(sqlMessage, params, callback) {
  if (sqlMessage) {
     //console.log("Database - ALL: SUCCESS");
    if(!params) {
      return db.all(sqlMessage, callback);
    }
    else {
      return db.all(sqlMessage, params, callback);

    }

  }
  else {
    errorConsole.throwError("SQL Message is undefined", "allDBMessage()", dbControllerName);
  }
}

function eachDBMessage(sqlMessage, params, callback) {
  if (sqlMessage) {
    //console.log("Database - EACH: SUCCESS");
    if(!params) {
      return db.each(sqlMessage, callback);
    }
    else {
      return db.each(sqlMessage, params, callback);

    }

  }
  else {
    errorConsole.throwError("SQL Message is undefined", "allDBMessage()", dbControllerName);
  }
}



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
  //console.log("NUM_PARAMS: " + numParams);
  return numParams;
}





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
  //console.log("PARAM STRING: " + paramString);
  return paramString;
}



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
  sqlMessage = sqlMessage.substring(0, sqlMessage.length-1);
  //console.log("SQL COMMAND: " + sqlMessage);
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

function getValues(data) {

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
  var count = 0;
  for (key in data) {
     //If contains COALESCE no quotes
     var matchString = ""+data[key];

     //Check if we have a COALESCE at the beginning no quotation marks
     if (matchString.match(/^COALESCE/i)){
         paramString += data[key];
     }
     //Otherwise insert quotations with the item
     else {
         paramString += "'"+data[key]+"'";
     }
     
     //If we are below the last number append a comma for the next '?'
     if (count < numParams-1) {
      paramString += ",";
     }
     count++;
  }
  //Close the param string
  paramString += ")";
  //console.log("VALUE STRING: " + paramString);
  return paramString;
}


//===== PUBLIC =================================================================
module.exports.createDatabase = createDatabase;
module.exports.insertInto = insertInto;
module.exports.update = update;
module.exports.selectAllFrom = selectAllFrom;
module.exports.selectFrom = selectFrom;
module.exports.runDBMessage = runDBMessage;
module.exports.getDBMessage = getDBMessage;
module.exports.allDBMessage = allDBMessage;
module.exports.eachDBMessage = eachDBMessage;
module.exports.getInputArray = getInputArray;
module.exports.db = db;

//For creating custom sql messages fast
module.exports.getWhereFields = getWhereFields;
module.exports.getSetFields = getSetFields;
module.exports.getSQLMessageByAppending = getSQLMessageByAppending;
module.exports.SQL_MSG = SQL_MSG;
module.exports.DB_FIELDS = DB_FIELDS;
module.exports.getValues = getValues;


