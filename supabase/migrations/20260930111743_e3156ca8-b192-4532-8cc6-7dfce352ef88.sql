WITH invalid AS (
  SELECT m.id
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND (
      (b.event = 'TRANSFER_SETTLEMENT' AND (
        (CASE WHEN 'cost:CARRIED' = ANY(m.tags) THEN 1 ELSE 0 END) +
        (CASE WHEN 'cost:LEGACY_COVERED' = ANY(m.tags) THEN 1 ELSE 0 END) +
        (CASE WHEN 'cost:INDETERMINATE' = ANY(m.tags) THEN 1 ELSE 0 END)
      ) <> 1)
      OR (b.event = 'INCORPORATION' AND NOT ('cost:INDETERMINATE' = ANY(m.tags)))
    )
)
SELECT count(*) AS inconsistent_records FROM invalid;