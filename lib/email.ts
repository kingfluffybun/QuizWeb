import { Resend } from "resend";

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

let cachedResendClient: Resend | null = null;
let cachedApiKey: string | undefined;

function getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
        return null;
    }
    if (!cachedResendClient || cachedApiKey !== apiKey) {
        cachedResendClient = new Resend(apiKey);
        cachedApiKey = apiKey;
    }
    return cachedResendClient;
}

function simulateDevEmailDispatch(to: string, html: string, reason: string) {
    console.warn(`Resend email delivery to ${to} skipped/failed (${reason}). Simulating dispatch in non-production.`);
    const otpMatch = html.match(/class="otp-code">(\d{6})<\/div>/);
    const linkMatch = html.match(/href="([^"]*\/verify-email\/[^"]*)"/);

    if (otpMatch?.[1]) {
        console.log(`\n========================================`);
        console.log(`Development OTP for ${to}: ${otpMatch[1]}`);
        console.log(`========================================\n`);
    }
    if (linkMatch?.[1]) {
        console.log(`\n========================================`);
        console.log(`Development Verify Link for ${to}: ${linkMatch[1]}`);
        console.log(`========================================\n`);
    }
    return { success: true as const, simulated: true as const };
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
    const isProd = process.env.NODE_ENV === "production";
    const resend = getResendClient();

    if (!resend) {
        if (!isProd) {
            return simulateDevEmailDispatch(to, html, "RESEND_API_KEY is not configured");
        }
        throw new Error("Email delivery is not configured: missing RESEND_API_KEY.");
    }

    const sender =
        from ||
        process.env.EMAIL_FROM ||
        (isProd ? "Quizweb <noreply@quizweb.dev>" : "Quizweb <onboarding@resend.dev>");

    try {
        const { data, error } = await resend.emails.send({
            from: sender,
            to: [to],
            subject,
            html,
        });

        if (error) {
            console.error("Resend error:", error);
            if (!isProd) {
                return simulateDevEmailDispatch(to, html, error.message);
            }
            throw new Error(error.message);
        }

        return { success: true, id: data?.id };
    } catch (err) {
        console.error("Failed to send email:", err);
        if (!isProd) {
            const reason = err instanceof Error ? err.message : "unknown error";
            return simulateDevEmailDispatch(to, html, reason);
        }
        throw err;
    }
}
