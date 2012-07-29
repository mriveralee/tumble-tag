
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http');

var SERVER_PORT = 8000;


//OAUTH
var passport = require('passport');
var passportTumblr = require('passport-tumblr');
var TumblrStrategy = passportTumblr.Strategy;
var OAUTH_KEYS = require('./TUMBLR_OAUTH_KEYS.js');

/// NODEMAILER
var mailer = require('./controllers/MailController.js')



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


});

app.configure('development', function(){
  app.use(express.errorHandler());
  app.set('port', app.get('port'));
});



//http.createServer(app).listen(app.get('port'), function(){
//  console.log("Express server listening on port " + app.get('port'));
//});

/////// ROUTES FOR TUMBLR AUTH

app.get('/', function(req, res){
  //mailer.sendMailWithMessage("TEST EMAIL WOOOO");
  res.render('index', { user: req.user});

});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
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
     // console.log(req);
      console.log("TUMBLR USER INFORMATION: \n");
      console.log(req);
      //res.redirect('/');

      mailer.sendMailWithMessage(req.user);
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
app.listen(SERVER_PORT, function(){console.log("*****************\nSERVER IS RUNNING ON PORT:"+SERVER_PORT)});
