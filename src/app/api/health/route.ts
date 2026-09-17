import { NextRequest, NextResponse } from "next/server";
import { ingestTokenMatches } from "@/lib/ingest-auth";

export async function GET(req: NextRequest) {
  /**
   * TEMPORARY. Reports the X-Forwarded-For chain exactly as the container
   * receives it, so the rate limiter can be keyed on the hop Cloud Run adds
   * rather than on one the caller can forge. Guessing at the chain's shape
   * has two failure modes and they are not symmetric: key on a forgeable hop
   * and the limit does nothing, key on a shared proxy hop and every user on
   * the planet lands in the same bucket.
   *
   * Gated behind the ingest token so it is never publicly readable, and to be
   * removed once the question is answered.
   */
  if (ingestTokenMatches(req.headers.get("x-ingest-token"), process.env.INGEST_TOKEN)) {
    return NextResponse.json({
      status: "ok",
      service: "kavach",
      forwardedFor: req.headers.get("x-forwarded-for"),
      realIp: req.headers.get("x-real-ip"),
    });
  }

  return NextResponse.json({ status: "ok", service: "kavach" });
}
