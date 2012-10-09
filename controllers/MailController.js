var nodemailer = require("nodemailer");
var sendMailTransport = nodemailer.createTransport("Sendmail");
var FROM_TUMBLE_TAG = "Tumble Tag <tumbletag@gmail.com>";

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
  service: "Gmail",
  auth: {
    user: "tumbletag@gmail.com",
    pass: "cctest123"
  }
});

// send mail with defined transport object
function sendTestMailWithMessage(message) {
  mailOptions.html = "OUR JSON IS: \n\n" + JSON.stringify(message);
  mailOptions.text = "OUR TEXT IS: \n\n" + message;
 smtpTransport.sendMail(mailOptions, function(error, response){
 // sendMailTransport.sendMail(mailOptions, function(error, response) {
    if(error){
        console.log(error);
      }
    else{
        console.log("Message sent: " + response.message);
      }
    // if you don't want to use this transport object anymore, uncomment following line
    //smtpTransport.close(); // shut down the connection pool, no more messages
  });
}

// send mail with defined transport object
function sendMail(mailOptions) {
  smtpTransport.sendMail(mailOptions, function(error, response){
    // sendMailTransport.sendMail(mailOptions, function(error, response) {
    if(error){
      console.log(error);
    }
    else{
      console.log("Message sent: " + response.message);
    }
    // if you don't want to use this transport object anymore, uncomment following line
    //smtpTransport.close(); // shut down the connection pool, no more messages
  });
}


/* Sends A Confirmation Email Message
 *
 */
function sendConfirmationEmail(userEmail, confirmationKey) {
    if (userEmail && confirmationKey) {
        var encodedKey = encodeURIComponent(confirmationKey);
        var encodedEmail = encodeURIComponent(userEmail);
        console.log(encodedKey + " : "+encodedEmail);
        // Route Param Version
        //var confirmationLink = "http://localhost:8000/confirm/"+encodedEmail+"/"+encodedKey;
        var confirmationLink = "http://mriveralee.test-tumble.jit.su/confirm/"+encodedEmail+"/"+encodedKey;
        var confirmationHTML = "<a href='" + confirmationLink + "'>"+ "Confirm Email"+"</a>";
                               
        // TODO: use a template
        var message = "To begin receiving tagging notifications, please confirm your email address:<br>" 
                        + confirmationHTML 
                        + "<br><br>Thanks,<br>TumbleTag Staff";
                        
       var mailOptions = {
          from: FROM_TUMBLE_TAG, // sender address   ✔
          to: userEmail, // list of receivers  comma separated
          subject: "You're Awesome- Thanks For Registering!", // Subject line
          text: message, // plaintext body
          html: message // html body
        }
        sendMail(mailOptions);
   }
}



function sendTaggedEmail(userEmail, taggedPosts) {
    if (userEmail && taggedPosts) {                       
        // TODO: use a template
        var message = "You were tagged in: \n" + JSON.stringify(taggedPosts);
                        
       var mailOptions = {
          from: FROM_TUMBLE_TAG, // sender address   ✔
          to: userEmail, // list of receivers  comma separated
          subject: "You've Been Tagged!", // Subject line
          text: message, // plaintext body
          html: message // html body
        }
        sendMail(mailOptions);
   }
}


//===== PUBLIC =================================================================
//module.exports.smtpTransport = smtpTransport;
//module.exports.sendMailTransport = sendMailTransport;
module.exports.sendConfirmationEmail = sendConfirmationEmail;
module.exports.sendTaggedEmail = sendTaggedEmail;
module.exports.sendMail = sendMail;

module.exports.sendTestMailWithMessage = sendTestMailWithMessage;

