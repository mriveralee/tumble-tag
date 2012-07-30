var nodemailer = require("nodemailer");
var sendMailTransport = nodemailer.createTransport("Sendmail");



// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
  service: "Gmail",
  auth: {
    user: "tumbletag@gmail.com",
    pass: "cctest123"
  }
});


// setup e-mail data with unicode symbols
var mailOptions = {
  from: "Tumble Tag <tumbletag@gmail.com>", // sender address   ✔
  to: "mrivera.lee@gmail.com", // list of receivers  comma separated
  subject: "You're Awesome- Thanks For Registering", // Subject line
  text: "Hello world ✔", // plaintext body
  html: "<b>Hello world ✔</b>" // html body
}

// send mail with defined transport object
function sendMailWithMessage(message) {
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
};



//===== PUBLIC =================================================================
module.exports.smtpTransport = smtpTransport;
module.exports.mailOptions = mailOptions;
module.exports.sendMailTransport = sendMailTransport;


module.exports.sendMailWithMessage = sendMailWithMessage;

