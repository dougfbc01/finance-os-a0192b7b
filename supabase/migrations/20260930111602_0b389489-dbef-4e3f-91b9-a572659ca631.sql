WITH candidates AS (
  SELECT m.id
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND (
      (b.event = 'TRANSFER_SETTLEMENT' AND NOT (
        'cost:CARRIED' = ANY(m.tags)
        OR 'cost:LEGACY_COVERED' = ANY(m.tags)
        OR 'cost:INDETERMINATE' = ANY(m.tags)
      ))
      OR (b.event = 'INCORPORATION' AND NOT ('cost:INDETERMINATE' = ANY(m.tags)))
    )
)
SELECT count(*) AS records_still_pending_reprocess FROM candidates;