import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseAdmin';

function getToken(req: Request): string | null {
  const auth = req.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = getSupabaseClient(getToken(req));

    if (Array.isArray(body)) {
      const { data, error } = await supabase
        .from('subtasks')
        .insert(body)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data || []);
    } else {
      const { task_id, name, completed, due_date } = body;

      if (!task_id || !name) {
        return NextResponse.json({ error: 'task_id and name are required' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          task_id,
          name,
          completed: completed || false,
          due_date: due_date || null,
        })
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data || []);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, task_id, ...updates } = body;
    const supabase = getSupabaseClient(getToken(req));

    if (!id && !task_id) {
      return NextResponse.json({ error: 'Either id or task_id is required' }, { status: 400 });
    }

    if (id) {
      // Update specific subtask by ID
      const { data, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data || []);
    } else {
      // Batch update subtasks by task_id
      const { data, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('task_id', task_id)
        .select();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(data || []);
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const supabase = getSupabaseClient(getToken(req));

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
