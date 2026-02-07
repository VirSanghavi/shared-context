import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  await clearSessionCookie();
  const url = new URL("/", req.url);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  await clearSessionCookie();
  const url = new URL("/", req.url);
  return NextResponse.redirect(url);
}
