-- Prepare recurring service schedules and draft invoices every morning (UTC).
-- Does not issue, send, or number invoices; only confirmed visits are billed.
select cron.schedule(
  'wimm-pro-recurring-drafts',
  '0 6 * * *',
  $$select budget_private.pro_recurring_sync(null); select budget_private.pro_recurring_prepare(null,false);$$
);