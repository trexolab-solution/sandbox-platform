import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "@/lib/auth-server";
import { db } from "@/database";
import { containers } from "@/database/schemas";
import { eq, and } from "drizzle-orm";
import { getAppSettings } from "@/lib/settings";
import { SandboxWorkspace } from "@/components/sandbox/sandbox-workspace";
import { Spinner } from "@/components/ui/spinner";

interface PageProps {
  params: Promise<{ containerId: string }>;
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default async function SandboxPage({ params }: PageProps) {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const { containerId } = await params;

  const [container, settings] = await Promise.all([
    db.query.containers.findFirst({
      where: and(
        eq(containers.id, containerId),
        eq(containers.userId, session.user.id)
      ),
      with: {
        portMappings: true,
      },
    }),
    getAppSettings(),
  ]);

  if (!container) {
    notFound();
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <SandboxWorkspace
        container={container}
        terminalSettings={{
          fontSize: settings.terminalFontSize,
          scrollback: settings.terminalScrollback,
        }}
      />
    </Suspense>
  );
}
