SELECT
  count(*) FILTER (WHERE 'cost:CARRIED' = ANY(m.tags)) AS cost_recovered,
  count(*) FILTER (WHERE 'cost:LEGACY_COVERED' = ANY(m.tags)) AS previously_covered,
  count(*) FILTER (WHERE 'cost:INDETERMINATE' = ANY(m.tags)) AS needs_review,
  count(*) AS total_treated
FROM public.b3_import_items b
JOIN public.movements m ON m.id = b.movement_id
WHERE b.status = 'IMPORTED'
  AND m.is_historical = true
  AND m.deleted_at IS NULL
  AND (b.event = 'TRANSFER_SETTLEMENT' OR b.event = 'INCORPORATION' OR (b.event = 'UPDATE' AND 'cost:INDETERMINATE' = ANY(m.tags)));