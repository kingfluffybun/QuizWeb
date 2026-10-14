import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY || "re_dummy_initialization_key";
const resend = new Resend(resendApiKey);

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
    const sender = "Quizweb <noreply@quizweb.dev>";

    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: [to],
            subject,
            html
        });

        if (error) {
            console.error("Resend error:", error);
            throw new Error(error.message);
        }

        return { success: true, id: data?.id };
    } catch (err) {
        console.error("Failed to send email:", err);
        throw err;
    }
}