import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  // If already authenticated, redirect based on role
  if (session?.user) {
    if (session.user.role === "admin") {
      redirect("/admin");
    } else {
      redirect("/sandbox");
    }
  }

  return children;
}
