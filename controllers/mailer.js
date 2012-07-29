var nodemailer = require("nodemailer");
var JSON = require('json');

// create reusable transport method (opens pool of SMTP connections)
var smtpTransport = nodemailer.createTransport("SMTP",{
  service: "Gmail",
  auth: {
    user: "gmail.user@gmail.com",
    pass: "userpass"
  }
});

// setup e-mail data with unicode symbols
var mailOptions = {
  from: "Sender Name ✔ <sender@example.com>", // sender address
  to: "receiver1@example.com, receiver2@example.com", // list of receivers
  subject: "Hello ✔", // Subject line
  text: "Hello world ✔", // plaintext body
  html: "<b>Hello world ✔</b>" // html body
}

// send mail with defined transport object
function sendMail(message) {
   mailOptions.html = "OUR JSON IS: \n\n" + JSON.stringify(message);
  smtpTransport.sendMail(mailOptions, function(error, response){
    if(error){
      console.log(error);
    }else{
      console.log("Message sent: " + response.message);
    }

    // if you don't want to use this transport object anymore, uncomment following line
    //smtpTransport.close(); // shut down the connection pool, no more messages
  });
}



module.exports.nodemailer = nodemailer;
module.exports.smtpTransport = smtpTransport;
module.exports.mailOptions = mailOptions;

