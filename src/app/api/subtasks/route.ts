import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      const { data, error } = await supabaseAdmin
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

      const { data, error } = await supabaseAdmin
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

    if (!id && !task_id) {
      return NextResponse.json({ error: 'Either id or task_id is required' }, { status: 400 });
    }

    if (id) {
      // Update specific subtask by ID
      const { data, error } = await supabaseAdmin
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
      const { data, error } = await supabaseAdmin
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

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
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
