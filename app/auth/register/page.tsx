import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { getSetting } from "@/lib/settings";

export default async function RegisterPage() {
  const registrationEnabled = await getSetting("newUserRegistrationEnabled");

  if (!registrationEnabled) {
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <RegisterForm />
    </div>
  );
}
