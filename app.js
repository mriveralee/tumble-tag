
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');

//Request for making HTTP(S) requests
var request = require('request');
//Parallel Function Calls
//var Step = require('step');
var async = require('async');


var SERVER_PORT = 8000;

// OAUTH
var passport = require('passport');
var passportTumblr = require('passport-tumblr');
var TumblrStrategy = passportTumblr.Strategy;
var OAUTH_KEYS = require('./TUMBLR_OAUTH_KEYS.js');

var OAuth = require('oauth').OAuth;
var OA = new OAuth(
  'http://www.tumblr.com/oauth/request_token',
  'http://www.tumblr.com/oauth/access_token',
  OAUTH_KEYS.tumblrConsumerKey,
  OAUTH_KEYS.tumblrConsumerSecret,
  '1.0A',
  'http://127.0.0.1:3000/auth/tumblr/callback',
  'HMAC-SHA1'
);


// Tumblr URLS
var TumblrURLS = {
    requestToken : 'http://www.tumblr.com/oauth/request_token',
    authorize : 'http://www.tumblr.com/oauth/authorize',
    accessToken : 'http://www.tumblr.com/oauth/access_token'
};

// NODE-MAILER
var mailer = require('./controllers/MailController.js');

// Crypto
var crypto = require('crypto');
var SALT = "BANANASALT-2";

// Databases
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./databases/tumbletag.db');
var databaseController = require('./controllers/DatabaseController');

// Error Console
var errorConsole = require('./controllers/ErrorConsoleController');

// Validator
var Validator = require('validator');
//var check = require('validator').check;
//var sanitize = require('validator').sanitize;




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
      callbackURL: "http://localhost:8000/auth/tumblr/callback"
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
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
});



//http.createServer(app).listen(app.get('port'), function(){
//  console.log("Express server listening on port " + app.get('port'));
//});

/////// ROUTES FOR TUMBLR AUTH



app.get('/', function(req, res){
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
         'username' : (req.user.username) ? (req.user.username) : "NO SUCH USER"
      };

      databaseController.update('users', setParams, whereParams);

      var count = 0;
      databaseController.selectAllFrom('users', whereParams, function(err, row) {
        if (err) {
          var errAtRow = err + "at row " + row;
          errorConsole.throwError(errAtRow, "selectAllFrom()", "app.js");
          return;
         }
        var userEmail = row['email'];
        console.log("ROW: " + row +" with EMAIL:" + userEmail);

        //Create confirmation Key
        var confirmationSha1 =  crypto.createHash('sha1');
        var currentDate = new Date();
        var timeString = currentDate.getTime() + "";
        confirmationSha1.update(SALT+userEmail+timeString);
        var confirmationKey = confirmationSha1.digest('base64');
        var encodedKey = encodeURIComponent(confirmationKey);
        var encodedEmail = encodeURIComponent(userEmail);

        console.log(encodedKey + " : "+encodedEmail);
        // Query String verision
       // var confirmationLink = "http://localhost:8000/confirmation?email="+encodedEmail+"&key="+encodedKey;

        // Route Param Version
        var confirmationLink = "http://localhost:8000/confirm/"+encodedEmail+"/"+encodedKey;

        var confirmationHTML = "<a href='" + confirmationLink + "'>"+ "Confirm Email"+"</a>";
        // TODO: use a template
        var message = confirmationHTML + "\n\nROW WAS: and count: " + count;

        var setUserParams = {
          'confirmation_key' : confirmationKey,
          'confirmed' : 0
        };

        var whereUserParams = {
          'id': row['id']
        };
        databaseController.update('users', setUserParams, whereUserParams);

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




// Query String version
//app.get('/confirm', function (req, res) {
//  console.log('confirmation route');
//});



app.get('/confirm/:email/:key', function (req, res) {
  //TODO: check sql injection against sanitize fxn
  var key = req.param('key');
  var email = req.param('email');
  if (email && key) {
    //Check if actual email
    var isEmail = Validator.check(email).isEmail();
    if (!isEmail) {
      res.send("Invalid Email address");
    }
    var validEmail = Validator.sanitize(email).str;
    var validKey = Validator.sanitize(key).str;

    if (validEmail && validKey) {
       var whereUserParams = {
        'email': validEmail,
        'confirmation_key': validKey
      };

      var setUserParams = {
        'confirmed' : 1
      };

      databaseController.selectAllFrom('users', whereUserParams, function(err, row) {
        if (err) {
          var errAtRow = err + "at row " + row;
          errorConsole.throwError(errAtRow, "selectFrom()", "app.js");
          res.send("No such User!");
          return;
        }
        whereUserParams.id = row['id'];
        if (row['confirmed'] === 0) {
          databaseController.update('users', setUserParams, whereUserParams);
          res.send("You are now confirmed! Wooo!");
        }
        else {
          res.send("You are already confirmed!");
        }
      });
    }
  }
  else {
    res.send("Oh no you bad boy- this doesn't work!");
  }
});











//   Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}



// Function for getting blog followers
app.get('/followers', function (req, res) {
 //my token/secret for testing need to keep updating when revoking access
 var token = "5tV1X0bphJ2Ra5M0Ax6Km2BLA4LvBy66hWljZQAiWWowNbjYvv";
 var token_secret = "t4fCMBipPE54SPyYRNqrSSN7mYizizN7QkSJ9voCrQxI5w7RSj";
 var blogName = "mikeriv.tumblr.com"; 
 
 var postsCallback = function(users, response) {
    var count = 0;
    var completionCount = 0;
    var followers = users;
    var followersLength = followers.length;
    //console.log(followers);
    var allPostData = [];
    
    
    //Function for What we do once we have post data for a user
    var grabbedPostDataCallback = function(posts) {
        //console.log("grabbed post for completion == "+ completionCount); 
        completionCount++; 
        if (posts) {
            //console.log("DATA AT CALLBACK");
            //console.log(posts);
            allPostData.push(posts);
        }
        if (completionCount == followersLength) {
            //console.log(allPostData);
            console.log("Sending all data to email");
            //Send the posts to email
            var message = JSON.stringify(allPostData);
            //mailer.sendMail("mrivera.lee@gmail.com", message);
            //TODO: TAKE THE DATA and scrap it for the current user's handle and then send notifcation
              
            //Returns the json
            //allPostData is an array containing all posts for followers
            response.send(allPostData);
        }
    };
    
    //Get all the data and append it together
    async.whilst(
        function() {
            //console.log("COUNT: " + count +" && FollowersMAX: " + followers.length);
            return (count < followers.length);
        },
        function(callback) {
           // console.log('LENGTH: '+followers.length + " COUNT: " + count);
            if (count < followers.length) {
                var user = followers[count];
                //console.log(count);
                getPostsForFollower(user, grabbedPostDataCallback);
                count++;
                callback();
            }
        },
        function(err) {
            if(err) {
                console.log(err);
            }
        }
   );
 };
 
 //Start the process of getting the followers and their posts
 getFollowers(blogName, token, token_secret, postsCallback, res);
  
 
});





function getFollowers(blogName, token, token_secret, postsCallback, res) {
    var TumblrFollowersURL = 'http://api.tumblr.com/v2/blog/'+blogName+'/followers';   

    OA.getProtectedResource(
        TumblrFollowersURL, 
        'GET', 
        token, 
        token_secret, 
        function(error, data, response) {
            if (error) {
             console.log(error);
             res.send(error);
            }
            else {
                 var parsedData = JSON.parse(data);
                 var users = parsedData.response ? parsedData.response.users : null;
                //console.log(users);
                if(postsCallback) {
                   postsCallback(users, res);
                }
            }
        }
     );
}

/* @Method: getPostsForFollower
 * Makes a TumblrAPI request to the posts for a particular user
 * @params: user - the user object to get posts for
 *          appendCallback - an optional callback for appending multiple posts
 * @returns: If not callback - the post data, otherwise it executes the callback with the data
 */
function getPostsForFollower(user, grabbedPostDataCallback) {
    //console.log('USER: \n')
    //console.log(user);
    var TumblrPostsURL = 'http://api.tumblr.com/v2/blog/'+user.name+'.tumblr.com'+'/posts?api_key='+OAUTH_KEYS.tumblrConsumerKey;
    request.get(TumblrPostsURL, function(error, response, data) {
        if (error) {
            console.log(error);
        }
        else if (data) {
            //console.log("POST FOR USER\n");
            //console.log(data);
            data = JSON.parse(data);
            var postsData= data.response ? data.response.posts : null;
           // console.log(data.response..posts);
            if (grabbedPostDataCallback) {
               // console.log("GRABBEDPOSTCALLBACK");
                grabbedPostDataCallback(postsData);
            }
            else {
                return postsData;
            }
        }
    });
}



/// LISTENING AT BOTTOM
app.listen(SERVER_PORT, function(){console.log("\n********************************\n* SERVER RUNNING ON PORT: "+SERVER_PORT+" *\n********************************\n")});



//===== PUBLIC =================================================================
module.exports.database = db;