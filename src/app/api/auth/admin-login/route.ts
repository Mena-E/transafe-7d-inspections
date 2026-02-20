import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { accessCode } = await req.json();

    const ADMIN_CODE = process.env.ADMIN_ACCESS_CODE;
    if (!ADMIN_CODE) {
      console.error("ADMIN_ACCESS_CODE not set in environment");
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    if (!accessCode || accessCode.trim() !== ADMIN_CODE.trim()) {
      return NextResponse.json({ error: "Invalid admin access code." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Admin login error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
