WITH transfer_rows AS (
  SELECT
    m.id,
    m.workspace_id,
    m.asset_id,
    m.transaction_date,
    m.created_at,
    CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Valor da Operação'), '') IS NULL OR BTRIM(b.raw_row->>'Valor da Operação') = '-' THEN 0
      ELSE REPLACE(BTRIM(b.raw_row->>'Valor da Operação'), ',', '.')::numeric
    END AS basis
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND b.event = 'TRANSFER_SETTLEMENT'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
),
legacy AS (
  SELECT workspace_id, asset_id, COALESCE(SUM(amount), 0) AS covered_basis
  FROM public.movements
  WHERE is_historical = true
    AND deleted_at IS NULL
    AND import_id IS NULL
    AND 'op:APORTE' = ANY(tags)
    AND description LIKE 'Aquisição histórica — %'
  GROUP BY workspace_id, asset_id
),
ranked AS (
  SELECT
    tr.*,
    COALESCE(l.covered_basis, 0) AS covered_basis,
    COALESCE(SUM(tr.basis) OVER (
      PARTITION BY tr.workspace_id, tr.asset_id
      ORDER BY tr.transaction_date, tr.created_at, tr.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS prior_basis
  FROM transfer_rows tr
  LEFT JOIN legacy l ON l.workspace_id = tr.workspace_id AND l.asset_id = tr.asset_id
),
updated AS (
  UPDATE public.movements m
  SET tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(
          array_remove(array_remove(array_remove(m.tags, 'cost:CARRIED'), 'cost:LEGACY_COVERED'), 'cost:INDETERMINATE')
          || CASE
               WHEN r.basis <= 0 THEN ARRAY['cost:INDETERMINATE']::text[]
               WHEN r.prior_basis + r.basis <= r.covered_basis + 0.005 THEN ARRAY['cost:LEGACY_COVERED']::text[]
               WHEN r.prior_basis < r.covered_basis THEN ARRAY[
                 'cost:CARRIED',
                 'cost:BASIS:' || GREATEST(0, r.prior_basis + r.basis - r.covered_basis)::text
               ]::text[]
               ELSE ARRAY['cost:CARRIED', 'cost:BASIS:' || r.basis::text]::text[]
             END
        ) tag
      ),
      updated_at = now()
  FROM ranked r
  WHERE m.id = r.id
    AND m.tags IS DISTINCT FROM ARRAY(
      SELECT DISTINCT tag
      FROM unnest(
        array_remove(array_remove(array_remove(m.tags, 'cost:CARRIED'), 'cost:LEGACY_COVERED'), 'cost:INDETERMINATE')
        || CASE
             WHEN r.basis <= 0 THEN ARRAY['cost:INDETERMINATE']::text[]
             WHEN r.prior_basis + r.basis <= r.covered_basis + 0.005 THEN ARRAY['cost:LEGACY_COVERED']::text[]
             WHEN r.prior_basis < r.covered_basis THEN ARRAY[
               'cost:CARRIED',
               'cost:BASIS:' || GREATEST(0, r.prior_basis + r.basis - r.covered_basis)::text
             ]::text[]
             ELSE ARRAY['cost:CARRIED', 'cost:BASIS:' || r.basis::text]::text[]
           END
      ) tag
    )
  RETURNING m.id
)
SELECT count(*) AS transfer_records_adjusted FROM updated;