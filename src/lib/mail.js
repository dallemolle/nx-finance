"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT === "465",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function sendTwoFactorEmail(email, code) {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "Seu código de verificação (2FA)",
        text: `Seu código de verificação é: ${code}`,
        html: `<p>Seu código de verificação é: <strong>${code}</strong></p>`,
    };

    return transporter.sendMail(mailOptions);
}

module.exports = { sendTwoFactorEmail };
