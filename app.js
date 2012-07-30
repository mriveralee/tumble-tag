
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');

var SERVER_PORT = 8000;

// OAUTH
var passport = require('passport');
var passportTumblr = require('passport-tumblr');
var TumblrStrategy = passportTumblr.Strategy;
var OAUTH_KEYS = require('./TUMBLR_OAUTH_KEYS.js');

// NODE-MAILER
var mailer = require('./controllers/MailController.js');

// Databases
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./databases/tumbletag.db');
var databaseController = require('./controllers/DatabaseController');

//Error Console
var errorConsole = require('./controllers/ErrorConsoleController');


////////PASSPORT - OAUTH

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Tumblr profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});



passport.use(new TumblrStrategy({
      consumerKey: OAUTH_KEYS.tumblrConsumerKey,
      consumerSecret: OAUTH_KEYS.tumblrConsumerSecret,
      callbackURL: "http://127.0.0.1:3000/auth/tumblr/callback"
    },
    function(token, tokenSecret, profile, done) {
      // asynchronous verification, for effect...
      process.nextTick(function () {

        // To keep the example simple, the user's Tumblr profile is returned to
        // represent the logged-in user.  In a typical application, you would want
        // to associate the Tumblr account with a user record in your database,
        // and return that user instead.
        var currentDate = new Date();
        console.log(profile);
        var data = {
          'username' : profile.username,
          'email' : '',
          'token' : token,
          'token_secret' : tokenSecret,
          'create_date' : currentDate.getTime()
        };
        databaseController.insertInto('users', data);
        return done(null, profile);
      });
    }
));
/////


//console.log("YOUR TUMBLR KEYS ARE: " + OAUTH_KEYS.tumblrConsumerKey + "SECRET: " + OAUTH_KEYS.tumblrConsumerSecret);


var app = express.createServer();

app.configure(function(){
  app.set('port',  process.env.port || 3000);  // process.env.port || 3000
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');        // app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret:'supGURLHowYouDoin' }));

  //Passport
  app.use(passport.initialize());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));

  //Make DB
  databaseController.createDatabase(db);



});
//
app.configure('development', function(){
  app.use(express.errorHandler());
  app.set('port', app.get('port'));
});



//http.createServer(app).listen(app.get('port'), function(){
//  console.log("Express server listening on port " + app.get('port'));
//});

/////// ROUTES FOR TUMBLR AUTH

app.get('/', function(req, res){
  //mailer.sendTestMailWithMessage("TEST EMAIL WOOOO");

//  var currentDate = new Date();
//  var data = {
//    'username' : 'TESTUsER',
//    'email' : 'mrivera.lee@gmail.com',
//    'token' : 'bananas',
//    'token_secret' : 'secret',
//    'create_date' : currentDate.getTime()
//  };
//
//
//  databaseController.insertInto('users', dataArray);
  res.render('index', { user: req.user});
});



app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});



app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.post('/loginWithEmail', function(req, res){
  console.log("LOGIN WITH EMAIL:" + req.body.email);

  //Store email in our session
  req.session.userName = req.body.email;

  res.redirect('/auth/tumblr');
});



// GET /auth/tumblr
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Tumblr authentication will involve redirecting
//   the user to tumblr.com.  After authorization, Tumblr will redirect the user
//   back to this application at /auth/tumblr/callback
app.get('/auth/tumblr',
    passport.authenticate('tumblr'),
    function(req, res){
      // The request will be redirected to Tumblr for authentication, so this
      // function will not be called.
    });





// GET /auth/tumblr/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.




// URL we give to tumblr is HOSTNAME.COM/auth/tumblr/callback
app.get('/auth/tumblr/callback',
    passport.authenticate('tumblr', { failureRedirect: '/login' }),
    function(req, res) {

      console.log("TUMBLR USER INFORMATION: \n");

      var setParams = {
        'email' : req.session.userName
      };

      var whereParams = {
         username : (req.user.username) ? (req.user.username) : "NO SUCH USER"
      };

      databaseController.update('users', setParams, whereParams);

      var count = 0;
      databaseController.selectAllFrom('users', whereParams, function(err, row) {
        if (err) {
          var errAtRow = err + "at row " + row;
          errorConsole.throwError(errAtRow, "selectAllFrom()", "app.js");
          return;
         }
        console.log("ROW: " + row +"with EMAIL:" + row['email']);
        var message = "ROW WAS:" + JSON.stringify(row) + "\n\n and count: " + count;
        mailer.sendMail(row['email'], message);
        count++;

      });

     // mailer.sendTestMailWithMessage(req.user);
      res.render('index', { user: req.user });

    });




app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});




// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}


/// LISTENING AT BOTTOM
app.listen(SERVER_PORT, function(){console.log("\n********************************\n* SERVER RUNNING ON PORT: "+SERVER_PORT+" *\n********************************\n")});



//===== PUBLIC =================================================================
module.exports.database = db;