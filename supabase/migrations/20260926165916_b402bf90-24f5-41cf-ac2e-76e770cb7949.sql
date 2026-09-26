WITH source_rows AS (
  SELECT
    m.id,
    b.event,
    CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Quantidade'), '') IS NULL OR BTRIM(b.raw_row->>'Quantidade') = '-' THEN NULL
      ELSE REPLACE(REPLACE(BTRIM(b.raw_row->>'Quantidade'), '.', ''), ',', '.')::numeric
    END AS raw_quantity,
    CASE
      WHEN NULLIF(BTRIM(b.raw_row->>'Valor da Operação'), '') IS NULL OR BTRIM(b.raw_row->>'Valor da Operação') = '-' THEN 0
      ELSE REPLACE(REPLACE(BTRIM(b.raw_row->>'Valor da Operação'), '.', ''), ',', '.')::numeric
    END AS raw_amount,
    UPPER(translate(COALESCE(b.raw_row->>'Entrada/Saída', ''), 'ÁÀÃÂÉÊÍÓÔÕÚÇáàãâéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) AS direction,
    m.tags
  FROM public.b3_import_items b
  JOIN public.movements m ON m.id = b.movement_id
  WHERE b.status = 'IMPORTED'
    AND m.is_historical = true
    AND m.deleted_at IS NULL
    AND b.event IN ('TRANSFER_SETTLEMENT', 'UPDATE', 'REVERSE_SPLIT', 'FRACTION', 'FRACTION_AUCTION', 'INCORPORATION')
), normalized AS (
  SELECT
    id,
    raw_quantity,
    CASE WHEN event = 'FRACTION_AUCTION' THEN raw_amount ELSE 0 END AS amount,
    ARRAY(
      SELECT DISTINCT tag
      FROM unnest(
        array_remove(
          array_remove(
            array_remove(tags, 'op:EVENTO'),
            'op:AJUSTE_QUANTIDADE'
          ),
          'qty:INCREASE'
        )
      ) AS tag
      WHERE tag NOT IN ('qty:DECREASE', 'qty:SET', 'qty:REALIZE')
      UNION ALL
      SELECT CASE WHEN event = 'FRACTION_AUCTION' THEN 'op:EVENTO' ELSE 'op:AJUSTE_QUANTIDADE' END
      UNION ALL
      SELECT CASE
        WHEN event IN ('UPDATE', 'REVERSE_SPLIT', 'INCORPORATION') THEN 'qty:SET'
        WHEN event = 'FRACTION_AUCTION' THEN 'qty:REALIZE'
        WHEN direction = 'DEBITO' THEN 'qty:DECREASE'
        ELSE 'qty:INCREASE'
      END
    ) AS tags
  FROM source_rows
  WHERE raw_quantity IS NOT NULL
)
UPDATE public.movements m
SET quantity = n.raw_quantity,
    amount = n.amount,
    tags = n.tags,
    updated_at = now()
FROM normalized n
WHERE m.id = n.id
  AND (
    m.quantity IS DISTINCT FROM n.raw_quantity
    OR m.amount IS DISTINCT FROM n.amount
    OR m.tags IS DISTINCT FROM n.tags
  );