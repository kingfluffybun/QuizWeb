import VerifyEmailClient from "./VerifyEmailClient";

interface VerifyEmailPageProps {
    params: Promise<{ token: string; }>;
}

export default async function VerifyEmailPage({
    params,
}: VerifyEmailPageProps) {
    const { token } = await params;

    // SEC-11: Zero database mutations on GET render.
    // The user must explicitly submit the POST activation form in VerifyEmailClient.
    return <VerifyEmailClient token={token} />;
}