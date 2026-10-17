import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || "re_dummy_initialization_key";
const resend = new Resend(resendApiKey);

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
    const sender = from || process.env.EMAIL_FROM || (process.env.NODE_ENV === "production" ? "Quizweb <noreply@quizweb.dev>" : "Quizweb <onboarding@resend.dev>");

    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: [to],
            subject,
            html
        });

        if (error) {
            console.error("Resend error:", error);
            if (process.env.NODE_ENV !== "production") {
                console.warn(`[DEV MODE] Resend email delivery to ${to} failed (${error.message}). Simulating successful dispatch for development.`);
                return { success: true, simulated: true };
            }
            throw new Error(error.message);
        }

        return { success: true, id: data?.id };
    } catch (err) {
        console.error("Failed to send email:", err);
        if (process.env.NODE_ENV !== "production") {
            console.warn(`[DEV MODE] Resend dispatch threw exception. Simulating successful dispatch for development.`);
            return { success: true, simulated: true };
        }
        throw err;
    }
}