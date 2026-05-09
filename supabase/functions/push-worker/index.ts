// supabase/functions/push-worker/index.ts
import { createClient } from 'supabase';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const CRON_SECRET = Deno.env.get('PUSH_WORKER_SECRET') ?? '';

interface DueRow {
  meetup_id: string;
  user_id: string;
  minutes_before: number;
  notify_at: string;
}

Deno.serve(async (req) => {
  if (CRON_SECRET) {
    const auth = req.headers.get('x-cron-secret') ?? '';
    if (auth !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 처리 대상 로드 (최대 200건/분)
  const { data: due, error } = await sb
    .from('meetup_reminders')
    .select('meetup_id, user_id, minutes_before, notify_at')
    .lte('notify_at', new Date().toISOString())
    .limit(200);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!due || due.length === 0) return new Response(JSON.stringify({ sent: 0 }));

  const userIds = [...new Set(due.map((d: DueRow) => d.user_id))];
  const meetupIds = [...new Set(due.map((d: DueRow) => d.meetup_id))];

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, expo_push_token')
    .in('id', userIds);
  const tokenById: Record<string, string | null> = {};
  for (const p of profiles ?? []) tokenById[p.id] = p.expo_push_token ?? null;

  const { data: meetups } = await sb
    .from('meetups')
    .select('id, title, starts_at')
    .in('id', meetupIds);
  const meetupById: Record<string, { title: string; starts_at: string }> = {};
  for (const m of meetups ?? []) meetupById[m.id] = { title: m.title, starts_at: m.starts_at };

  const messages: any[] = [];
  for (const r of due as DueRow[]) {
    const tok = tokenById[r.user_id];
    if (!tok) continue;
    const m = meetupById[r.meetup_id];
    if (!m) continue;
    messages.push({
      to: tok,
      sound: 'default',
      title: m.title,
      body: `${r.minutes_before}분 후 시작`,
      data: { meetup_id: r.meetup_id },
    });
  }

  // Expo는 100개/배치
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch(EXPO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip, deflate' },
      body: JSON.stringify(batch),
    });
  }

  // 처리 완료 행 삭제 (멀티 PK)
  for (const r of due as DueRow[]) {
    await sb.from('meetup_reminders').delete()
      .eq('meetup_id', r.meetup_id).eq('user_id', r.user_id).eq('minutes_before', r.minutes_before);
  }

  return new Response(JSON.stringify({ processed: due.length, sent: messages.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
