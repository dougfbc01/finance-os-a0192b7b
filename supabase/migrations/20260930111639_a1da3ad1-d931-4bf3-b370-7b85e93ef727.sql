WITH pending AS (
  SELECT m.id
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND b.event IN ('TRANSFER_SETTLEMENT', 'INCORPORATION')
    AND NOT (
      'cost:CARRIED' = ANY(m.tags)
      OR 'cost:LEGACY_COVERED' = ANY(m.tags)
      OR 'cost:INDETERMINATE' = ANY(m.tags)
    )
)
SELECT count(*) AS pending FROM pending;