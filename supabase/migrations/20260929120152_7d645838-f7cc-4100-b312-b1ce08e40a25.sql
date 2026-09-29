WITH transfer_costs AS (
  SELECT
    b.id AS item_id,
    m.id AS movement_id,
    m.workspace_id,
    m.asset_id,
    m.transaction_date,
    m.quantity,
    CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Valor da Operação'), '') IS NULL OR BTRIM(b.raw_row->>'Valor da Operação') = '-' THEN NULL
      ELSE REPLACE(BTRIM(b.raw_row->>'Valor da Operação'), ',', '.')::numeric
    END AS basis
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND b.event = 'TRANSFER_SETTLEMENT'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
),
covered_assets AS (
  SELECT DISTINCT tc.workspace_id, tc.asset_id
  FROM transfer_costs tc
  JOIN public.movements seed
    ON seed.workspace_id = tc.workspace_id
   AND seed.asset_id = tc.asset_id
   AND seed.is_historical = true
   AND seed.deleted_at IS NULL
   AND seed.import_id IS NULL
   AND 'op:APORTE' = ANY(seed.tags)
   AND seed.description LIKE 'Aquisição histórica — %'
),
tagged_transfers AS (
  UPDATE public.movements m
  SET tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(
          array_remove(array_remove(array_remove(m.tags, 'cost:CARRIED'), 'cost:LEGACY_COVERED'), 'cost:INDETERMINATE')
          || CASE
               WHEN ca.asset_id IS NOT NULL THEN ARRAY['cost:LEGACY_COVERED']::text[]
               WHEN tc.basis IS NOT NULL AND tc.basis > 0 THEN ARRAY['cost:CARRIED', 'cost:BASIS:' || tc.basis::text]::text[]
               ELSE ARRAY['cost:INDETERMINATE']::text[]
             END
        ) tag
      ),
      updated_at = now()
  FROM transfer_costs tc
  LEFT JOIN covered_assets ca ON ca.workspace_id = tc.workspace_id AND ca.asset_id = tc.asset_id
  WHERE m.id = tc.movement_id
    AND (
      (ca.asset_id IS NOT NULL AND NOT ('cost:LEGACY_COVERED' = ANY(m.tags)))
      OR (ca.asset_id IS NULL AND tc.basis IS NOT NULL AND tc.basis > 0 AND NOT ('cost:CARRIED' = ANY(m.tags)))
      OR (ca.asset_id IS NULL AND (tc.basis IS NULL OR tc.basis <= 0) AND NOT ('cost:INDETERMINATE' = ANY(m.tags)))
    )
  RETURNING m.id
),
conversion_candidates AS (
  SELECT m.id
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  JOIN public.assets a ON a.id = m.asset_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND (b.event = 'INCORPORATION' OR (b.event = 'UPDATE' AND a.ticker = 'IRIM11'))
),
tagged_conversions AS (
  UPDATE public.movements m
  SET tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(array_remove(m.tags, 'cost:CARRIED') || ARRAY['cost:INDETERMINATE']::text[]) tag
      ),
      updated_at = now()
  FROM conversion_candidates c
  WHERE m.id = c.id
    AND NOT ('cost:INDETERMINATE' = ANY(m.tags))
  RETURNING m.id
)
SELECT
  (SELECT count(*) FROM tagged_transfers) AS transfer_records_changed,
  (SELECT count(*) FROM tagged_conversions) AS conversion_records_flagged;