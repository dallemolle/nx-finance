import { connection } from "next/server";
import { redirect } from "next/navigation";
import { isRegistrationOpen } from "@/lib/services/account";
import { RegisterForm } from "./register-form";

// Cadastro fechado (padrão, BL-043): quem chega aqui vai pro login.
export default async function RegisterPage() {
    await connection();
    if (!isRegistrationOpen()) redirect("/auth/login");
    return <RegisterForm />;
}
