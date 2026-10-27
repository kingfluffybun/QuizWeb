import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getPreloadLearnSectionData } from "@/app/actions/progress";
import type { RowDataPacket } from "mysql2/promise";

export const GET = async (req: Request): Promise<Response> => {
  try {
    const session = await auth();

    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId = session.user.id ? Number(session.user.id) : undefined;
    if ((!userId || !Number.isInteger(userId) || userId < 1) && session.user.email) {
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT user_id FROM user_auth_tbl WHERE email = ? LIMIT 1",
        [session.user.email],
      );
      if (rows[0]?.user_id) {
        userId = Number(rows[0].user_id);
      }
    }

    if (!userId || !Number.isInteger(userId) || userId < 1) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let requestedSectionId: number | undefined;
    try {
      const url = new URL(req.url);
      const secParam = url.searchParams.get("sectionId");
      if (secParam != null && secParam.trim() !== "") {
        const parsed = Number(secParam);
        if (Number.isInteger(parsed) && parsed > 0) {
          requestedSectionId = parsed;
        }
      }
    } catch {
      // Ignore invalid URL parsing in unit tests
    }

    const payload = await getPreloadLearnSectionData(userId, requestedSectionId);

    return Response.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=120, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/learn/preload:", error);
    return Response.json(
      { error: "Failed to preload learn section" },
      { status: 500 },
    );
  }
};
