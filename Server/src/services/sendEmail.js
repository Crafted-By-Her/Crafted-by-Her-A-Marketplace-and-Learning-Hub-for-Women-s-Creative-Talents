const nodemailer = require("nodemailer");
require("dotenv").config();

// Log environment variables for debugging
console.log("EMAIL_USERNAME:", process.env.EMAIL_USERNAME);
console.log("EMAIL_PASSWORD:", process.env.EMAIL_PASSWORD);

const emailUser = process.env.EMAIL_USERNAME;
const emailPass = process.env.EMAIL_PASSWORD ;

if (!emailUser || !emailPass) {
  console.error(
    "Error: Email credentials are missing. Check .env file or fallback credentials."
  );
}

// Create reusable transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

// Send email function
const sendEmail = async (to, subject, text, html) => {
  try {
    // Validate input
    if (!to || !subject || !text) {
      throw new Error(
        "Missing required email parameters: to, subject, or text"
      );
    }

    const mailOptions = {
      from: `"Crafted By Her" <${emailUser}>`,
      replyTo: emailUser,
      to,
      subject,
      text,
      html,
    };

    console.log(`Sending email to ${to} with subject: ${subject}`);
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error; // Let the caller handle the error
  }
};

// Verify SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
  } else {
    console.log("SMTP connection verified successfully");
  }
});

module.exports = sendEmail;
