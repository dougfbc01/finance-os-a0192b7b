WITH mismatches AS (
  SELECT m.id
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND b.event IN ('TRANSFER_SETTLEMENT', 'UPDATE', 'REVERSE_SPLIT', 'SPLIT', 'BONUS', 'FRACTION', 'INCORPORATION')
    AND m.quantity IS DISTINCT FROM CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Quantidade'), '') IS NULL OR BTRIM(b.raw_row->>'Quantidade') = '-' THEN NULL
      ELSE REPLACE(BTRIM(b.raw_row->>'Quantidade'), ',', '.')::numeric
    END
)
SELECT count(*) AS quantity_mismatches FROM mismatches;