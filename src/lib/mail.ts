import nodemailer from "nodemailer";

export async function send2FACode(email: string, code: string) {
    // This is a placeholder for actual email sending logic
    // You would use an SMTP service or similar here
    console.log(`Sending 2FA code ${code} to email ${email}`);
    return true;
}
