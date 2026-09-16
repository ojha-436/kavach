import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth-server";
import { listActivity, clearActivity } from "@/lib/firestore-admin";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ entries: [], signedIn: false });
  return NextResponse.json({
    entries: await listActivity(user.uid),
    signedIn: true,
  });
}

/** Right to erasure, and it actually erases. */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  await clearActivity(user.uid);
  return NextResponse.json({ cleared: true });
}
