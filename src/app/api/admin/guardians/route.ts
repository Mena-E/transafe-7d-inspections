import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET guardians for a student (via student_guardians join)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("student_id");
    if (!studentId) {
      return NextResponse.json({ error: "Missing student_id" }, { status: 400 });
    }

    // Get student_guardians join rows
    const { data: sgRows, error: sgErr } = await supabaseAdmin
      .from("student_guardians")
      .select("id, guardian_id, relationship")
      .eq("student_id", studentId);
    if (sgErr) throw sgErr;

    const joinRows = (sgRows || []) as {
      id: string;
      guardian_id: string;
      relationship: string | null;
    }[];

    if (joinRows.length === 0) {
      return NextResponse.json({ guardians: [] });
    }

    const guardianIds = joinRows.map((row) => row.guardian_id);

    const { data: gRows, error: gErr } = await supabaseAdmin
      .from("guardians")
      .select("id, full_name, phone, email, preferred_contact_method")
      .in("id", guardianIds);
    if (gErr) throw gErr;

    const map = new Map<string, any>();
    (gRows || []).forEach((g: any) => {
      map.set(g.id, g);
    });

    const guardians = joinRows.map((row) => {
      const g = map.get(row.guardian_id);
      return {
        linkId: row.id,
        id: row.guardian_id,
        full_name: g?.full_name ?? "Unknown guardian",
        phone: g?.phone ?? null,
        email: g?.email ?? null,
        preferred_contact_method: g?.preferred_contact_method ?? null,
        relationship: row.relationship ?? null,
      };
    });

    return NextResponse.json({ guardians });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: create a guardian and link to student
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { student_id, full_name, phone, email, preferred_contact_method, relationship } = body;

    if (!student_id) {
      return NextResponse.json({ error: "Missing student_id" }, { status: 400 });
    }

    // 1) Create guardian
    const { data: newGuardian, error: gErr } = await supabaseAdmin
      .from("guardians")
      .insert({
        full_name: full_name,
        phone: phone,
        email: email || null,
        preferred_contact_method: preferred_contact_method || "call",
      })
      .select()
      .single();
    if (gErr) throw gErr;

    // 2) Link guardian to student
    const { data: linkRow, error: linkErr } = await supabaseAdmin
      .from("student_guardians")
      .insert({
        student_id,
        guardian_id: newGuardian.id,
        relationship: relationship || null,
      })
      .select()
      .single();
    if (linkErr) throw linkErr;

    return NextResponse.json({
      guardian: {
        linkId: linkRow.id,
        id: newGuardian.id,
        full_name: newGuardian.full_name,
        phone: newGuardian.phone,
        email: newGuardian.email,
        preferred_contact_method: newGuardian.preferred_contact_method,
        relationship: linkRow.relationship,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove guardian link (student_guardians row)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get("link_id");
    if (!linkId) {
      return NextResponse.json({ error: "Missing link_id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("student_guardians")
      .delete()
      .eq("id", linkId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
