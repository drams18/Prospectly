import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ReminderRow {
  id: string;
  user_id: string;
  prospect_id: string;
  remind_at: string;
  title: string;
  comment: string | null;
  prospects: { name: string } | null;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Invoked every minute by a pg_cron job (see migration 0006 comments for the
// scheduling setup) with the service-role key as Bearer auth — this is a
// server-to-server call, never reachable with a user's own token, and it
// deliberately queries across every user's due reminders in one pass.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hitmind.pro@gmail.com';
  const appUrl = Deno.env.get('APP_URL') ?? 'https://prospectly.app';

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const nowIso = new Date().toISOString();
  const { data: due, error: dueError } = await supabase
    .from('reminders')
    .select('id, user_id, prospect_id, remind_at, title, comment, prospects(name)')
    .eq('status', 'pending')
    .is('notified_at', null)
    .lte('remind_at', nowIso);

  if (dueError) {
    console.error('[send-reminders] fetch due reminders failed', dueError);
    return json({ error: dueError.message }, 500);
  }

  const reminders = (due ?? []) as unknown as ReminderRow[];
  if (reminders.length === 0) return json({ processed: 0, usersNotified: 0 });

  const byUser = new Map<string, ReminderRow[]>();
  for (const r of reminders) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  let usersNotified = 0;

  for (const [userId, userReminders] of byUser) {
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (subsError) {
      console.error('[send-reminders] fetch subscriptions failed', subsError);
      continue;
    }

    // Point 12: group same-time reminders into a single notification instead
    // of spamming one per prospect.
    const payload = userReminders.length === 1
      ? {
          title: '📞 Prospect à rappeler',
          body: [
            userReminders[0].prospects?.name,
            new Date(userReminders[0].remind_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            userReminders[0].comment,
          ].filter(Boolean).join(' — '),
          url: `/prospects/${userReminders[0].prospect_id}`,
        }
      : {
          title: '📞 Rappels',
          body: `Vous avez ${userReminders.length} prospects à rappeler.`,
          url: '/rappels',
        };

    for (const sub of (subs ?? []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ ...payload, url: `${appUrl}${payload.url}` }),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('[send-reminders] push send failed', err);
        }
      }
    }

    usersNotified += 1;

    await supabase
      .from('reminders')
      .update({ notified_at: nowIso })
      .in('id', userReminders.map((r) => r.id));
  }

  return json({ processed: reminders.length, usersNotified });
});
