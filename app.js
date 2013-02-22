/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var http = require('http');
var SERVER_PORT = 8000;
var CONFIG = require('./config/config.js');

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
var SALT = CONFIG.SALT;

// Error Console
var errorConsole = require('./controllers/ErrorConsoleController');

// Validator
var Validator = require('validator');

/***************** MONGODB *****************************/
var mongoose = require('mongoose'),
	connect = require('connect'),
	MongoStore = require('connect-mongodb');

var my_db = CONFIG.my_db;
//Local Debugging
//var my_db = 'mongodb://localhost/test';
var db = mongoose.connect(my_db);

/****************** END MONGODB *********************/
//// TESTING NODE PAD APP CRAP





///// App Configurations
//var app = express.createServer();   //Deprecated
var app = express();

app.configure(function() {
	app.set('port', process.env.port || 3000);
	app.set('views', __dirname + '/views');
	
	//Template Enginer
	app.set('view engine', 'ejs');

	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());

	//Session Management 
	app.use(express.cookieParser()); 
	app.use(express.session({ 
		store: MongoStore(my_db), 
		secret: 'OMG_SuperTopSecret!@#54^!!!!!!flfdd:CW' 
	}));


	//DEBUG
	app.use(express.errorHandler());
	//Passport
	app.use(passport.initialize());
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});
//
app.configure('development', function() {
	app.use(express.errorHandler());
	app.set('port', app.get('port'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser());
});

/********** MONGO SCHEMA ******************/

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



/************ ************* ****************/








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
			'confirmed' : false,
			'date_created' : currentDate.getTime(),
			'timestamp_last_tagged' : 0		
		};

		delete data.username;

		var whereParams = {
			'username' : profile.username
		};

    	//Update or insert this user into the database
		UserModel.update(whereParams, data, {upsert: true}, function(err){
			if (err) {
				throw err;
				console.log("Could not upsert user");
			}
			else {
				console.log("Added users to database");
			}
		});
		
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
		var userEmail = req.session.userName;
		var setParams = {
			'email' : userEmail
		};
		var whereParams = {
			'username' : (req.user.username) ? (req.user.username) : "NO SUCH USER"
		};

		//Search for user if they exist
		UserModel.findOne(whereParams, function(err, user) {
	    	if (err) {
	    		throw err;
	    		return;
	    	}
	    	if (user != null) {
				//Create sha1 confirmation Key
				var confirmationSha1 = crypto.createHash('sha1');
				var currentDate = new Date();
				var timeString = currentDate.getTime() + "";

				confirmationSha1.update(SALT + userEmail + timeString);
				var confirmationKey = confirmationSha1.digest('base64');

				//Modify the user paraments
				user.email = userEmail;
				user.confirmation_key = confirmationKey;
				user.confirmed = false;

				//Save updates in our db
				user.save(function(err) {
			      if (err)
			        console.log('error - adding user to db');
			      else
			        console.log('success - adding user to db');
					mailer.sendConfirmationEmail(userEmail, confirmationKey);
			    });
	    	}
	    });
		res.render('index', {
			user : req.user
		});
});

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

//Route for confirming a user in the db

app.get('/confirm/:email/:key', function(req, res) {
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

		//If no trickery in our email or key, find the user in our db
		if(validEmail && validKey && validKey != "") {
			var whereUserParams = {
				'email' : validEmail,
				'confirmation_key' : validKey
			};

			UserModel.findOne(whereUserParams, function(err, user) {
		    	//No such user/key
		    	if (err) {
		    		sendErrorResponse(res, "Invalid Confirmation Key");
		    		return;
		    	}
		    	//If we have a user, update them
		    	if (user != null) {
			   		console.log(user);
			   		if (user.confirmed === true) {
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
		}
	} 
	else {
		sendErrorResponse(res, "Invalid Confirmation Key");
	}
});


//Function - Sends an error response message
function sendErrorResponse(res, message) {
	var errorMessage = "Error: " + message;
	res.send(errorMessage);
}

//Function - Sends a response message
function sendResponse(res, message) {
	res.send(message);
}




//Function - runs process for grabbins tagged posts and emailing them for each user in the db
function getTaggedPostsForAllUsers(req, res) {
	UserModel.find({}, function(err, allUsers){
    	//console.log(allUsers);
		if(err) {
			throw err
			return;
		} 
		else if(allUsers && allUsers.length > 0) {
			for (var i = 0; i < allUsers.length; i++) {
				var currentUser = allUsers[i];
				// If unconfirmed user we stop
				if (!currentUser['confirmed']){
					return;
				}
				var token = currentUser['oauth_token'];
				var token_secret = currentUser['oauth_secret'];
				//If our username has a different name/blog url like with a '.com' address we use it otherwise append .tumblr
				var blogName = (currentUser['username'].match(/\u002e/gi)) ? currentUser['username'] : currentUser['username'] + ".tumblr.com";
				console.log("BLOG NAME :   " + blogName);
				var username = currentUser['username'];
				var userTag = currentUser['username'];
				var userEmail = currentUser['email'];
				var timestampLastTagged = currentUser['timestamp_last_tagged'];

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
									
									//var msg = cronMsg + JSON.stringify(postsWithUsernameTag);
									//TODO: FILTER POSTSWITHUSERNAMETAG AND only get needed info from it. use FORMATPOSTSFOREMAIL
									var formattedPostsWithTag = formatPostsForEmail(postsWithUsernameTag);
									
									var cronMsg = "Cron Times: " + cronTimes + "\n\n";
									var msg = cronMsg + JSON.stringify(postsWithUsernameTag);



									mailer.sendTaggedEmail(userEmail, msg);
									//Update the time of the last tagged post in our DB
									var lastTagged = mostRecentTimestamp+1;

									///////// CORRECT THIS --- NEED TO TELL WHO THE POST CAME FROM IF THERE ARE 2 POSTS AT THE SAME TIME
									currentUser.timestamp_last_tagged = lastTagged;
									currentUser.save(function(err) {
								    	if (err){
								        	console.log('error updating timestamp');
									    } 
									    else {
									        console.log('success updating timestamp');
										}
							    	});
									//databaseController.update('users', setParams, whereParams);
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
		} 
				//Start the process of getting the followers and their posts
			});
}


// Filter objects/methods for Posts 
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



/// TEMPLATE LOADING 
var ejs = require('ejs'),
    fs = require('fs');
    //TaggedPostTemplate = fs.readFileSync(__dirname + Templates.taggedPosts, 'ascii'),
    
    // USE FOR RENDERING THE TEMPLATE
    //rendered = ejs.render(file, { locals: { items:[1,2,3] } });

var Templates = { taggedPosts: fs.readFileSync(__dirname + '/templates/tagged-post.ejs', 'ascii')};

function filterPostForEmail(post) {
	if(post) {
		var postType = post.type;
		//ALL HAVE: date, post_url, blog_name, note_count, type
		var formattedPost = {
			date: post.date,
			post_url: post_url,
			blog_name: post.blog_name,
			note_count: post.note_count,
			type: postType
		};
		//Based on type, get body of the post
		switch (postType) {
			case POST_TYPE.text:
				//Has title, body
				formattedPost.body = post.body;
				formattedPost.title = posts.title;
				break;
			case POST_TYPE.photo:
				//Has caption
				formattedPost.caption = post.caption;
				break;
			case POST_TYPE.quote:
				//testm source, source_title, source_url
				postBody = 'source';
				break;
			case POST_TYPE.link:
				//title, description
				postBody = 'description';
				break;
			case POST_TYPE.chat:
				//title, body
				postBody = 'body';
				break;
			case POST_TYPE.audio:
				//caption, id3_title
				postBody = 'caption';
				break;
			case POST_TYPE.video:
				//caption, source_title
				postBody = 'caption';
				break;
			case POST_TYPE.answer:
				//asking_name, asking_url, question, answer
				postBody = 'answer';
				break;
			default:
				postBody = 'body';
				break;
		}
	}
	return formattedPost;
}


//Formats an array of posts into a string for sending with the email message
function formatPostsForEmail(posts) {
	var formattedPosts = [];
	for (var i = 0; i < posts.length; i++) {
		//Get Type of post
		var formattedPost = filterPostForEmail(posts[i]);
		formattedPosts.push(formattedPost);
	}

	//Now turn formatted Posts into template string
	var templatedPosts = ejs.render(Templates.taggedPosts, { locals: { posts:formattedPosts } });
	return formattedPosts;

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




/// LISTENING AT BOTTOM
app.listen(SERVER_PORT, function() {
	console.log("\n********************************\n* SERVER RUNNING ON PORT: " + SERVER_PORT + " *\n********************************\n");
});




//Cron Job For Checking For Tagged Posts 
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
