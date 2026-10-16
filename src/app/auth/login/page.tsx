import { connection } from "next/server";
import { isRegistrationOpen } from "@/lib/services/account";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
    // Lê ALLOW_REGISTRATION a cada requisição, não no build (BL-043).
    await connection();
    return <LoginForm registrationOpen={isRegistrationOpen()} />;
}
