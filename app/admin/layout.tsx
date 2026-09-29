import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cookies } from "next/headers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/admin/login");
  }

  if (session.user.role !== "admin") {
    redirect("/sandbox");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader user={session.user} />
        <ScrollArea className="flex-1">
          <main className="container max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            {children}
          </main>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
