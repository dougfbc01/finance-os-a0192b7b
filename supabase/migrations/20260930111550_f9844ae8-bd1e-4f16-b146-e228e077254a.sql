WITH covered_assets AS (
  SELECT DISTINCT m.workspace_id, m.asset_id
  FROM public.movements m
  WHERE m.is_historical = true
    AND m.deleted_at IS NULL
    AND m.import_id IS NULL
    AND 'op:APORTE' = ANY(m.tags)
    AND m.description LIKE 'Aquisição histórica — %'
),
updated AS (
  UPDATE public.movements m
  SET tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(
          array_remove(array_remove(array_remove(m.tags, 'cost:CARRIED'), 'cost:INDETERMINATE'), 'cost:LEGACY_COVERED')
          || ARRAY['cost:LEGACY_COVERED']::text[]
        ) tag
      ),
      updated_at = now()
  FROM public.b3_import_items b
  JOIN covered_assets ca ON ca.workspace_id = b.workspace_id AND ca.asset_id = b.asset_id
  WHERE b.movement_id = m.id
    AND b.status = 'IMPORTED'
    AND b.event = 'TRANSFER_SETTLEMENT'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND (NOT ('cost:LEGACY_COVERED' = ANY(m.tags)) OR 'cost:CARRIED' = ANY(m.tags) OR 'cost:INDETERMINATE' = ANY(m.tags))
  RETURNING m.id
)
SELECT count(*) AS records_harmonized FROM updated;