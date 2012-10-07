/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var SERVER_PORT = 8000;

//Request for making HTTP(S) requests
var request = require('request');

//Serial Function Calls
var async = require('async');

// Tumblr URLS
var TumblrURLS = {
	requestToken : 'http://www.tumblr.com/oauth/request_token',
	authorize : 'http://www.tumblr.com/oauth/authorize',
	accessToken : 'http://www.tumblr.com/oauth/access_token'
};

// OAUTH & Passport
var passport = require('passport');
var passportTumblr = require('passport-tumblr');
var TumblrStrategy = passportTumblr.Strategy;
var OAUTH_KEYS = require('./TUMBLR_OAUTH_KEYS.js');

var OAuth = require('oauth').OAuth;
var OA = new OAuth(TumblrURLS.requestToken, TumblrURLS.accessToken, OAUTH_KEYS.tumblrConsumerKey, OAUTH_KEYS.tumblrConsumerSecret, '1.0A', 'http://127.0.0.1:3000/auth/tumblr/callback', 'HMAC-SHA1');

// NODE-MAILER
var mailer = require('./controllers/MailController.js');

// Crypto
var crypto = require('crypto');
var SALT = "BANANASALT-2";

// Databases
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('./databases/tumbletag.db');
var databaseController = require('./controllers/DatabaseController');
//var db = {};
// Error Console
var errorConsole = require('./controllers/ErrorConsoleController');

// Validator
var Validator = require('validator');
//var check = require('validator').check;
//var sanitize = require('validator').sanitize;


/***************** MONGODB *****************************/
var mongoose = require('mongoose');
//mongoose.connect('mongodb://nodejitsu:9c28b994d494429442ba453dd21f1faf@alex.mongohq.com:10059/nodejitsudb763664407039');
//var db = mongoose.createConnection('mongodb://nodejitsu:9c28b994d494429442ba453dd21f1faf@alex.mongohq.com:10059/nodejitsudb763664407039');
var db = mongoose.createConnection('mongodb://127.0.0.1/test');

var userSchema = new mongoose.Schema({
	'id' : String,
	'username' : String,
	'email' : String,
    'oauth_token' : String,
	'oauth_secret' : String,
	'confirmation_key' : String,
	'confirmed' : Boolean,
	'date_created' : Number,
	'timestamp_last_tagged' : Number
});

userSchema.methods.setEmail = function(email) {
	this.email = email;
}
userSchema.methods.setConfirmationKey = function(key) {
	this.confirmation_key = key;
}
userSchema.methods.setConfirmed = function(isConfirmed) {
	this.confirmed = isConfirmed;
}
userSchema.methods.setTimestampLastTagged = function(runTimestamp) {
	this.timestamp_last_tagged = runTimestamp;
}


var UserModel = db.model('User', userSchema);
/****************** END MONGODB *********************/


//Deprecated
//var app = express.createServer();

 var app = express();


//// TESTING NODE PAD APP CRAP
var connect= require('connect'),
MongoStore = require('connect-mongodb'),
my_db = "mongodb://localhost/test",
db = mongoose.connect(my_db);
///

/**
    * Model: LoginToken
    *
    * Used for session persistence.
    */
  var LoginToken = new mongoose.Schema({
    email: { type: String, index: true },
    series: { type: String, index: true },
    token: { type: String, index: true }
  });

  LoginToken.method('randomToken', function() {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  LoginToken.pre('save', function(next) {
    // Automatically create the tokens
    this.token = this.randomToken();

    if (this.isNew)
      this.series = this.randomToken();

    next();
  });

  LoginToken.virtual('id')
    .get(function() {
      return this._id.toHexString();
    });

  LoginToken.virtual('cookieValue')
    .get(function() {
      return JSON.stringify({ email: this.email, token: this.token, series: this.series });
    });

  mongoose.model('LoginToken', LoginToken);



/////




app.configure(function() {
	app.set('port', process.env.port || 3000);
	// process.env.port || 3000
	app.set('views', __dirname + '/views');
	app.set('view engine', 'ejs');
	// app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());

	 app.use(express.cookieParser()); 
	app.use(express.session({ store: MongoStore(my_db), secret: 'topsecret~1!!!' }));

	 //express.session({ secret: 'keyboard cat', store: new MemoryStore({ reapInterval: 60000 * 10 })});
	/*app.use(express.session({
		store: new MongoStore({ db : mongoose.connection.db }),
		maxAge: new Date(Date.now() + 3600000),
		secret : 'supGURLHowYouDoin'
	}));
*/

	//DEBUG
	app.use(express.errorHandler());
	//Passport
	app.use(passport.initialize());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));

	//Make DB
	//databaseController.createDatabase(db);
});
//
app.configure('development', function() {
	app.use(express.errorHandler());
	app.set('port', app.get('port'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser());
});
//http.createServer(app).listen(app.get('port'), function(){
//  console.log("Express server listening on port " + app.get('port'));
//});






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
	consumerKey : OAUTH_KEYS.tumblrConsumerKey,
	consumerSecret : OAUTH_KEYS.tumblrConsumerSecret,
	callbackURL : "http://localhost:8000/auth/tumblr/callback"
}, function(token, tokenSecret, profile, done) {

	// asynchronous verification, for effect...
	process.nextTick(function() {

		// To keep the example simple, the user's Tumblr profile is returned to
		// represent the logged-in user.  In a typical application, you would want
		// to associate the Tumblr account with a user record in your database,
		// and return that user instead.
		var currentDate = new Date();
		//console.log(profile);
		var data = {
			'index' : {unique:true, dropDups:true},
		    'username' : profile.username,
			'oauth_token' : token,
			'oauth_secret' : tokenSecret,
			'confirmation_key' : "",
			'confirmed' : 0,
			'date_created' : currentDate.getTime(),
			'timestamp_last_tagged' : 0		
		};

		delete data.username;

		var whereParams = {
			'username' : profile.username
		};

	UserModel.update(whereParams, data, {upsert: true}, function(err){});

	   /* UserModel.findOne(whereParams, function(err, user) {
	    	if (user != null) {


	    	}

	    });*/
		//databaseController.insertInto('users', data);

		//console.log(data);
		//var msg = "INSERT OR REPLACE INTO " + "users " + databaseController.DB_FIELDS.users + " VALUES " + databaseController.getValues(data);
		//console.log("RUN MESSAGE \n\n"+msg+"\n\n\n");
////////// DB REPLACE
/*		db.run(msg, function(error, row) {
			if(error) {
				console.log(error);
			} else {
				//Do nothing
				//console.log("ROW is: " + JSON.stringify(row));
			}
		});

*/
		return done(null, profile);
	});
}));
/////

///Routes

app.get('/', function(req, res) {
	res.render('index', {
		user : req.user
	});
});

app.get('/account', ensureAuthenticated, function(req, res) {
	res.render('account', {
		user : req.user
	});
});

app.get('/login', function(req, res) {
	res.render('login', {
		user : req.user
	});
});

app.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

app.post('/loginWithEmail', function(req, res) {
	//Store email in our session
	//console.log("LOGIN WITH EMAIL:" + req.body.email);



	//var loginToken = new LoginToken({ email: req.body.email });
       /* loginToken.save(function() {
          res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' });
          res.redirect('/documents');*/
        //});
	req.session.userName = req.body.email;
	res.redirect('/auth/tumblr');
});
/////// ROUTES FOR TUMBLR AUTH

// GET /auth/tumblr
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Tumblr authentication will involve redirecting
//   the user to tumblr.com.  After authorization, Tumblr will redirect the user
//   back to this application at /auth/tumblr/callback
app.get('/auth/tumblr', passport.authenticate('tumblr'), function(req, res) {
	// The request will be redirected to Tumblr for authentication, so this
	// function will not be called.
});
// GET /auth/tumblr/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
//  URL we give to tumblr is HOSTNAME.COM/auth/tumblr/callback
app.get('/auth/tumblr/callback', 
	passport.authenticate('tumblr', {failureRedirect : '/login'}), 
	function(req, res) {
		//console.log("TUMBLR USER INFORMATION: \n");

		var setParams = {
			'email' : req.session.userName
		};
		var whereParams = {
			'username' : (req.user.username) ? (req.user.username) : "NO SUCH USER"
		};
		//databaseController.update('users', setParams, whereParams);
		var count = 0;
		///////////////////////////DB CHANGE
		 UserModel.findOne(whereParams, function(err, user) {
	    	if (err) {
	    		throw err;
	    		return;
	    	}
	    	if (user != null) {
		    		// var userEmail = row['email'];
				var userEmail = req.session.userName;
				//console.log("ROW: " + row +" with EMAIL:" + userEmail);

				//Create confirmation Key
				var confirmationSha1 = crypto.createHash('sha1');
				var currentDate = new Date();
				var timeString = currentDate.getTime() + "";

				confirmationSha1.update(SALT + userEmail + timeString);
				var confirmationKey = confirmationSha1.digest('base64');
				console.log("A CKEY :" + confirmationKey);
				var setUserParams = {
					'email' : userEmail,
					'confirmation_key' : confirmationKey,
					'confirmed' : 0
				};

				user.email = userEmail;
				user.confirmation_key = confirmationKey;
				user.confirmed = 0;

				user.save(function(err) {
			      if (err)
			        console.log('error');
			      else
			        console.log('success');
					mailer.sendConfirmationEmail(userEmail, confirmationKey);
					count++;
					console.log("\n\n***************");
					console.log(user);
					console.log("\n\n***************");
			    });

				// var whereUserParams = {
				// 	'username' : row['username']
				// };
				//console.log("\n\nCONFIRM KEY: " + row['confirmation_key']);
				
				// var whereParams = {
				// 	'username' : profile.username
				// };

	//UserModel.update(whereParams, data, {upsert: true}, function(err){});


				//databaseController.update('users', setUserParams, whereUserParams);

	    	}
	    });



	/*	databaseController.selectAllFrom('users', whereParams, function(err, row) {
			if(err) {
				var errAtRow = err + "at row " + row;
				errorConsole.throwError(errAtRow, "selectAllFrom()", "app.js");
				return;
			}
			// var userEmail = row['email'];
			var userEmail = req.session.userName;
			//console.log("ROW: " + row +" with EMAIL:" + userEmail);

			//Create confirmation Key
			var confirmationSha1 = crypto.createHash('sha1');
			var currentDate = new Date();
			var timeString = currentDate.getTime() + "";

			confirmationSha1.update(SALT + userEmail + timeString);
			var confirmationKey = confirmationSha1.digest('base64');

			var setUserParams = {
				'email' : userEmail,
				'confirmation_key' : confirmationKey,
				'confirmed' : 0
			};

			var whereUserParams = {
				'username' : row['username']
			};
			console.log("\n\nCONFIRM KEY: " + row['confirmation_key']);
			databaseController.update('users', setUserParams, whereUserParams);

			mailer.sendConfirmationEmail(userEmail, confirmationKey);
			count++;
		});
	*/
		res.render('index', {
			user : req.user
		});
});

app.get('/confirm/:email/:key', function(req, res) {
	//TODO: check sql injection against sanitize fxn
	var key = req.param('key');
	var email = req.param('email');
	if(email && key) {
		//Check if actual email
		var isEmail = Validator.check(email).isEmail();
		if(!isEmail) {
			sendErrorResponse(res, "Invalid Email address");
		}
		var validEmail = Validator.sanitize(email).str;
		var validKey = Validator.sanitize(key).str;


		if(validEmail && validKey && validKey != "") {
			var whereUserParams = {
				'email' : validEmail,
				'confirmation_key' : validKey
			};

			var setUserParams = {
				'confirmed' : 1
				//,'confirmation_key' : ""
			};

			 UserModel.findOne(whereUserParams, function(err, user) {
		    	if (err) {
		    		sendErrorResponse(res, "Invalid Confirmation Key");
		    		return;
		    	}
		    	if (user != null) {
			   		if (user.confirmed === 1) {
			   			sendResponse(res, "You are already confirmed! Wooo!");
						return;
			   		}
			   		else {
			   			user.confirmed = 1;
						user.save(function(err) {
					    	if (err){
					        	console.log('error confirming user');
					    		sendErrorResponse(res, "Error confirming user");
					    		return;
						    } 
						    else {
						        console.log('success confirming user');
						    	sendResponse(res, "You are confirmed! Wooo!");
								return;
							}
				    	});
					}
				}
			});



	/////// DB REPLACE
/*	
			databaseController.update('users', setUserParams, whereUserParams, function(err) {
				if(err) {
					// Error in table
					var errAtRow = err + "at row " + row;
					errorConsole.throwError(errAtRow, "selectFrom()", "app.js");
					sendErrorResponse(res, "Database Error");
					return;
				}
				var hasChanges = this.changes;
				console.log(this.changes);
				if(hasChanges) {
					//If User exists in database with these credentials for email and & confirmation key
					sendResponse(res, "You are confirmed! Wooo!");
					return;
				} else {
					//No Changes means no user in the table/invalid key
					// logic for resending confirmation key?
					sendErrorResponse(res, "Invalid Confirmation Key");
					return;
				}
			});*/
		}
	} else {
		sendErrorResponse(res, "Invalid Confirmation Key");
	}
});


//Sends an error response message
function sendErrorResponse(res, message) {
	var errorMessage = "Error: " + message;
	res.send(errorMessage);
}

//Sends a response message
function sendResponse(res, message) {
	res.send(message);
}

//   Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
	if(req.isAuthenticated()) {
		return next();
	}
	res.redirect('/login');
}

function getTaggedPostsForAllUsers(req, res) {
	console.log("WOOOO");
	UserModel.find({}, function(err, allUsers){
    	console.log(allUsers);

	});

	//my token/secret for testing need to keep updating when revoking access
	/* var token = "5tV1X0bphJ2Ra5M0Ax6Km2BLA4LvBy66hWljZQAiWWowNbjYvv";
	var token_secret = "t4fCMBipPE54SPyYRNqrSSN7mYizizN7QkSJ9voCrQxI5w7RSj";
	var blogName = "mikeriv.tumblr.com";
	var username = "mikeriv";
	var userTag = "mikeriv";
	var userEmail = "mrivera.lee@gmail.com";
	*/
	//databaseController.update('users', setParams, whereParams);
	// Get All USers From The Table
	
////// DB REPLACE

/*	databaseController.selectAllFrom('users', "ALL", function(err, row) {
		if(err) {
			var errAtRow = err + "at row " + row;
			errorConsole.throwError(errAtRow, "selectAllFrom()", "app.js");
			return;
		} 
		else if(row && row['confirmed'] === 1) {
			// If unconfirmed user we stop
			var token = row['oauth_token'];
			var token_secret = row['oauth_secret'];
			//If our username has a different name/blog url like with a '.com' address we use it otherwise append .tumblr
			var blogName = (row['username'].match(/\u002e/gi)) ? row['username'] : row['username'] + ".tumblr.com";
			console.log("BLOG NAME :   " + blogName);
			var username = row['username'];
			var userTag = row['username'];
			var userEmail = row['email'];
			var timestampLastTagged = row['timestamp_last_tagged'];

			// var userEmail = row['email']
			//  'username': row['username']
			if(blogName && username && userTag && userEmail && token && token_secret && timestampLastTagged >= -1) {
				/// database each message
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
						if(posts) {
							//console.log("DATA AT CALLBACK");
							//console.log(posts);
							allPostData.push(posts);
						}
						if(completionCount == followersLength) {
							//Send the posts to email
							var message = JSON.stringify(allPostData);
							//console.log(message);
							//mailer.sendMail("mrivera.lee@gmail.com", message);
							//TODO: TAKE THE DATA and scrap it for the current user's handle and then send notifcation
							//Returns the json
							//allPostData is an array containing  arrays of all posts for followers
							var postsWithUsernameTag = [];
							var nameRegEx = new RegExp(userTag, "ig");
							var mostRecentTimestamp = timestampLastTagged;
							//Check all posts for our username
							for(postsKey in allPostData) {
								var posts = allPostData[postsKey];
								//console.log(post);
								for(key in posts) {
									var post = posts[key];
									var postTimestamp = post['timestamp'] ? post['timestamp'] : -1;
									//var postBody = getBodyForPost(post);
									if(postTimestamp >= timestampLastTagged) {
										var postTags = post['tags'];
										// console.log("TAGS: " + postTags);
										var hasTagForUsername = false;
										if(postTags) {
											for(var tagNum = 0; tagNum < postTags.length; tagNum++) {
												var tag = postTags[tagNum];
												var taggedUsername = tag.match(nameRegEx);
												if(taggedUsername) {
													hasTagForUsername = true;
													break;
												}
											}
											if(hasTagForUsername) {
												postsWithUsernameTag.push(post);
												if(mostRecentTimestamp < postTimestamp) {
													mostRecentTimestamp = postTimestamp;
												}
											}
										}
									}
								}
							}
							//If we have posts send our mail message
							if(postsWithUsernameTag.length > 0) {
								var cronMsg = "Cron Times: " + cronTimes + "\n\n";
								var msg = cronMsg + JSON.stringify(postsWithUsernameTag);
								//

								mailer.sendTaggedEmail(userEmail, msg);
								//Update the time of the last tagged post in our DB
								var lastTagged = mostRecentTimestamp+1;
								var setParams = {
									'timestamp_last_tagged' : lastTagged
								};
								var whereParams = {
									'username' : row['username'],
									'email' : row['email'],
									'oauth_token' : row['oauth_token'],
									'oauth_secret' : row['oauth_secret']
								};
								databaseController.update('users', setParams, whereParams);
								// response.send(postsWithUsernameTag);
								// response.send(allPostData);
							}
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
							if(count < followers.length) {
								var user = followers[count];
								//console.log(count);
								getPostsForFollower(user, userTag, grabbedPostDataCallback);
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
				}
				getFollowers(blogName, token, token_secret, postsCallback, res);
			}		
		} 
		//Start the process of getting the followers and their posts
	});
	*/
}

//Formats an array of posts into a string for sending with the email message
function formatPostsForEmail(posts) {

}

// Function for getting blog followers with a tage
app.get('/followers', getTaggedPostsForAllUsers);

function getFollowers(blogName, token, token_secret, postsCallback, res) {
	var TumblrFollowersURL = 'http://api.tumblr.com/v2/blog/' + blogName + '/followers';

	OA.getProtectedResource(TumblrFollowersURL, 'GET', token, token_secret, function(error, data, response) {
		if(error) {
			console.log(error);
			res.send(error);
		} else {
			var parsedData = JSON.parse(data);
			var users = parsedData.response ? parsedData.response.users : null;
			//console.log(users);
			if(postsCallback) {
				postsCallback(users, res);
			}
		}
	});
}

/* @Method: getPostsForFollower
 * Makes a TumblrAPI request to the posts for a particular user
 * @params: user - the user object to get posts for
 *          appendCallback - an optional callback for appending multiple posts
 * @returns: If not callback - the post data, otherwise it executes the callback with the data
 */
function getPostsForFollower(user, userTag, grabbedPostDataCallback) {
	//console.log('USER: \n')
	//console.log(user);
	var TumblrPostsURL = 'http://api.tumblr.com/v2/blog/' + user.name + '.tumblr.com' + '/posts?api_key=' + OAUTH_KEYS.tumblrConsumerKey + '&tag=' + userTag;

	request.get(TumblrPostsURL, function(error, response, data) {
		if(error) {
			console.log(error);
		} else if(data) {
			//console.log("POST FOR USER\n");
			//console.log(data);
			data = JSON.parse(data);
			var postsData = data.response ? data.response.posts : null;
			// console.log(data.response..posts);
			if(grabbedPostDataCallback) {
				// console.log("GRABBEDPOSTCALLBACK");
				grabbedPostDataCallback(postsData);
			} else {
				return postsData;
			}
		}
	});
}

var POST_TYPE = {
	'text' : 'text',
	'photo' : 'photo',
	'quote' : 'quote',
	'link' : 'link',
	'chat' : 'chat',
	'audio' : 'audio',
	'video' : 'video',
	'answer' : 'answer'
}

function getBodyForPost(post) {
	var postBody = "";
	if(post) {
		var postType = post.type;
		switch (postType) {
			case POST_TYPE.text:
				postBody = 'body';
				break;
			case POST_TYPE.photo:
				postBody = 'caption';
				break;
			case POST_TYPE.quote:
				postBody = 'source';
				break;
			case POST_TYPE.link:
				postBody = 'description';
				break;
			case POST_TYPE.chat:
				postBody = 'body';
				break;
			case POST_TYPE.audio:
				postBody = 'caption';
				break;
			case POST_TYPE.video:
				postBody = 'caption';
				break;
			case POST_TYPE.answer:
				postBody = 'answer';
				break;
			default:
				postBody = 'body';
				break;
		}
	}
	return postBody;
}

/// LISTENING AT BOTTOM
app.listen(SERVER_PORT, function() {
	console.log("\n********************************\n* SERVER RUNNING ON PORT: " + SERVER_PORT + " *\n********************************\n")
});
//Cron Jobs
var cronJob = require('cron').CronJob;
var cronTimes = 0;
var TaggedPostsMailerJob = new cronJob({
	//Currently Runs Every Minute was at 2 mins
	//cronTime : '0 0 0 * * * ', //Every day at 12AM mins
	cronTime : '*/20 * * * * * ', //Every 10 seconds
	// FOR TESTING EVERY TEN SECONDS '*/10 * * * * * ',//'00 30 11 * * 1-7',  0 */2
	onTick : function() {
		// Runs every weekday (Monday through Friday)
		// at 11:30:00 AM. It does not run on Saturday
		// or Sunday.
		cronTimes++;
		getTaggedPostsForAllUsers();
		console.log("JOB RAN WITH TIME:" + cronTimes);
	},
	start : true, // Run our Cron Job or use TaggedPostsMailerJob.start();
	//timeZone : "America/New_York"
});

//===== PUBLIC =================================================================
module.exports.database = db;
