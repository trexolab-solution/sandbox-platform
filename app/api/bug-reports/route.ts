import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { db } from "@/database";
import { bugReports } from "@/database/schemas";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { TelegramService } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || undefined;

    const body = await request.json();
    const { title, description, category, priority, pageUrl, screenshot } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "Title and description are required" },
        { status: 400 }
      );
    }

    const validCategories = ["ui", "functionality", "performance", "security", "other"];
    const validPriorities = ["low", "medium", "high", "critical"];

    const reportId = nanoid();
    const reportCategory = validCategories.includes(category) ? category : "other";
    const reportPriority = validPriorities.includes(priority) ? priority : "medium";

    const bugReport = await db.insert(bugReports).values({
      id: reportId,
      userId: session?.user?.id || null,
      title: title.slice(0, 200),
      description: description.slice(0, 5000),
      category: reportCategory,
      priority: reportPriority,
      pageUrl: pageUrl?.slice(0, 500),
      userAgent: userAgent?.slice(0, 500),
      screenshot: screenshot?.slice(0, 500000), // Limit screenshot size
      status: "open",
    }).returning();

    // Send Telegram notification for bug report
    TelegramService.sendBugReportNotification({
      reportId,
      title: title.slice(0, 200),
      description: description.slice(0, 5000),
      category: reportCategory,
      priority: reportPriority,
      userName: session?.user?.name || undefined,
      userEmail: session?.user?.email || undefined,
      pageUrl: pageUrl?.slice(0, 500),
    }).then((result) => {
      if (result.success) {
        console.log(`[Telegram] Bug report notification sent for ${reportId}`);
      } else {
        console.error(`[Telegram] Failed to send bug report notification: ${result.error}`);
      }
    }).catch((err) => {
      console.error("[Telegram] Error sending bug report notification:", err);
    });

    return NextResponse.json({
      success: true,
      id: bugReport[0].id,
      message: "Bug report submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting bug report:", error);
    return NextResponse.json(
      { error: "Failed to submit bug report" },
      { status: 500 }
    );
  }
}
