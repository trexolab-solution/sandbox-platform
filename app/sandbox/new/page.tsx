import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { CreateSandboxWizard } from "@/components/sandbox/create-sandbox-wizard";
import { BASE_IMAGES } from "@/lib/docker/runtime-images";

import { ScrollArea } from "@/components/ui/scroll-area";

export default async function NewSandboxPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const images = BASE_IMAGES.map((image) => ({
    id: image.value,
    name: image.label,
    description: image.description,
  }));

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
        <CreateSandboxWizard images={images} />
      </div>
    </ScrollArea>
  );
}
