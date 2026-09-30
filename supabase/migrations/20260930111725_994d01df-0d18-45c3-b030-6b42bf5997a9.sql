SELECT count(*) AS cash_impact_violations
FROM public.b3_import_items b
JOIN public.movements m ON m.id = b.movement_id
WHERE b.status = 'IMPORTED'
  AND m.is_historical = true
  AND m.deleted_at IS NULL
  AND (
    b.event = 'TRANSFER_SETTLEMENT'
    OR b.event = 'INCORPORATION'
    OR (b.event = 'UPDATE' AND 'cost:INDETERMINATE' = ANY(m.tags))
  )
  AND (m.amount <> 0 OR m.account_id IS NOT NULL OR m.card_id IS NOT NULL OR m.invoice_id IS NOT NULL);