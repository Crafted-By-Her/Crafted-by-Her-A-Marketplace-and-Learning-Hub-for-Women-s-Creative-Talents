// testSmtp.js
require("dotenv").config();
const nodemailer = require("nodemailer");
console.log(process.env.EMAIL_USERNAME);
console.log(process.env.EMAIL_PASSWORD);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});
transporter.verify((error, success) => {
  if (error) console.error("SMTP error:", error);
  else console.log("SMTP ready");
});
