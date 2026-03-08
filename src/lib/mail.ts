export async function sendTwoFactorTokenEmail(email: string, token: string) {
    // In a real application, you would use a service like Resend, SendGrid, or nodemailer.
    // For this initial structure, we will log to the console.
    console.log(`[AUTH] Sending 2FA code ${token} to ${email}`);

    // Example with Resend (commented out):
    /*
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Seu código de verificação 2FA",
      html: `<p>Seu código de verificação é: <strong>${token}</strong></p>`
    });
    */
}
