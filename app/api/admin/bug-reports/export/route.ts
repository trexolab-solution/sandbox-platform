import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { db } from "@/database";
import { bugReports, user } from "@/database/schemas";
import { desc, eq, and, or } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "markdown";
    const status = url.searchParams.get("status") || "all";
    const includeResolved = url.searchParams.get("includeResolved") === "true";

    // Build query conditions
    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(bugReports.status, status as any));
    }

    if (!includeResolved) {
      conditions.push(
        and(
          or(
            eq(bugReports.status, "open"),
            eq(bugReports.status, "in_progress")
          )
        ) as any
      );
    }

    // Get bug reports with user info
    const reports = await db
      .select({
        id: bugReports.id,
        title: bugReports.title,
        description: bugReports.description,
        category: bugReports.category,
        priority: bugReports.priority,
        status: bugReports.status,
        pageUrl: bugReports.pageUrl,
        userAgent: bugReports.userAgent,
        adminNotes: bugReports.adminNotes,
        createdAt: bugReports.createdAt,
        updatedAt: bugReports.updatedAt,
        resolvedAt: bugReports.resolvedAt,
        userId: bugReports.userId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(bugReports)
      .leftJoin(user, eq(bugReports.userId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bugReports.priority), desc(bugReports.createdAt));

    // Remove duplicates based on title similarity (simple approach)
    const uniqueReports = [];
    const seenTitles = new Set<string>();

    for (const report of reports) {
      const normalizedTitle = report.title.toLowerCase().trim();
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        uniqueReports.push(report);
      }
    }

    // Group by category
    const categorizedReports = {
      security: uniqueReports.filter((r) => r.category === "security"),
      functionality: uniqueReports.filter((r) => r.category === "functionality"),
      performance: uniqueReports.filter((r) => r.category === "performance"),
      ui: uniqueReports.filter((r) => r.category === "ui"),
      other: uniqueReports.filter((r) => r.category === "other"),
    };

    if (format === "json") {
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        totalBugs: uniqueReports.length,
        categories: categorizedReports,
      });
    }

    // Generate AI-ready Markdown format
    let markdown = `# Bug Report Export
Generated on: ${new Date().toLocaleString()}
Total Unique Bugs: ${uniqueReports.length}

---

## Instructions for AI
This document contains categorized bug reports for fixing. Each bug includes:
- **Title**: Brief description of the issue
- **Priority**: Critical, High, Medium, or Low
- **Status**: Current state (open, in_progress, resolved, etc.)
- **Description**: Detailed explanation
- **Page URL**: Location where the bug occurs (if applicable)
- **Admin Notes**: Additional context from administrators

Please analyze each bug and provide fixes in the following format:
1. Root cause analysis
2. Recommended fix
3. Code changes needed
4. Testing suggestions

---

`;

    // Add each category
    const categoryTitles = {
      security: "🔒 Security Issues",
      functionality: "⚙️ Functionality Bugs",
      performance: "⚡ Performance Issues",
      ui: "🎨 UI/UX Issues",
      other: "📋 Other Issues",
    };

    for (const [category, title] of Object.entries(categoryTitles)) {
      const bugs = categorizedReports[category as keyof typeof categorizedReports];
      if (bugs.length === 0) continue;

      markdown += `## ${title} (${bugs.length})\n\n`;

      bugs.forEach((bug, index) => {
        markdown += `### ${index + 1}. ${bug.title}\n\n`;
        markdown += `**Priority:** ${bug.priority.toUpperCase()} | **Status:** ${bug.status.replace("_", " ").toUpperCase()}\n\n`;

        if (bug.pageUrl) {
          markdown += `**Page URL:** ${bug.pageUrl}\n\n`;
        }

        markdown += `**Description:**\n${bug.description}\n\n`;

        if (bug.adminNotes) {
          markdown += `**Admin Notes:**\n${bug.adminNotes}\n\n`;
        }

        if (bug.userAgent) {
          markdown += `<details>\n<summary>Technical Details</summary>\n\n`;
          markdown += `**User Agent:** \`${bug.userAgent}\`\n\n`;
          markdown += `**Reported:** ${new Date(bug.createdAt).toLocaleString()}\n`;
          if (bug.userName) {
            markdown += `**Reporter:** ${bug.userName} (${bug.userEmail})\n`;
          }
          markdown += `</details>\n\n`;
        }

        markdown += `---\n\n`;
      });
    }

    markdown += `
## Summary Statistics

| Category | Count |
|----------|-------|
| Security | ${categorizedReports.security.length} |
| Functionality | ${categorizedReports.functionality.length} |
| Performance | ${categorizedReports.performance.length} |
| UI/UX | ${categorizedReports.ui.length} |
| Other | ${categorizedReports.other.length} |
| **Total** | **${uniqueReports.length}** |

---

*This export was generated automatically from the bug tracking system.*
`;

    // Return as downloadable file
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="bug-report-export-${new Date().toISOString().split("T")[0]}.md"`,
      },
    });
  } catch (error) {
    console.error("Error exporting bug reports:", error);
    if (error instanceof Error && error.message === "Forbidden: Admin access required") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to export bug reports" },
      { status: 500 }
    );
  }
}
