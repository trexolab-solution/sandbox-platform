import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";

export default async function AdminAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  // If already authenticated as admin, redirect to admin dashboard
  if (session?.user?.role === "admin") {
    redirect("/admin");
  }

  return children;
}
