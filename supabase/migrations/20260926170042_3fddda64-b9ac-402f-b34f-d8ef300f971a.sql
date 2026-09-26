UPDATE public.movements m
SET quantity = CASE m.id
      WHEN 'feac328f-b566-4c83-ae50-08b2d1c7a938'::uuid THEN 1
      WHEN '441dd97d-323f-415b-8f6f-0d0fbbea2780'::uuid THEN 2
    END,
    amount = 0,
    tags = ARRAY[
      'source:B3',
      'b3:event:TRANSFER_SETTLEMENT',
      'b3:type:Transferência - Liquidação',
      'op:AJUSTE_QUANTIDADE',
      'qty:INCREASE'
    ]::text[],
    updated_at = now()
WHERE m.id IN (
  'feac328f-b566-4c83-ae50-08b2d1c7a938'::uuid,
  '441dd97d-323f-415b-8f6f-0d0fbbea2780'::uuid
)
AND (
  m.quantity IS NULL
  OR NOT (m.tags @> ARRAY['op:AJUSTE_QUANTIDADE','qty:INCREASE']::text[])
);