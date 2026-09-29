import { describe, expect, it } from "vitest";
import { CommitmentServiceImpl } from "@/services/CommitmentService";
import { MovementStatus, MovementType } from "@/constants/enums";
import type { Commitment, CommitmentInstallment } from "@/models/Commitment";
import type { Movement } from "@/models";

const commitment: Pick<Commitment, "account_id" | "card_id"> = {
  account_id: "account-1",
  card_id: null,
};

const installment: Pick<CommitmentInstallment, "due_date" | "amount"> = {
  due_date: "2026-09-20",
  amount: 250,
};

const movement = (over: Partial<Movement>): Movement => ({
  id: "m1",
  workspace_id: "ws",
  account_id: "account-1",
  transfer_account_id: null,
  category_id: null,
  subcategory_id: null,
  card_id: null,
  invoice_id: null,
  asset_id: null,
  import_id: "import-1",
  transfer_group_id: null,
  type: MovementType.EXPENSE,
  status: MovementStatus.CLEARED,
  description: "PARCELA",
  notes: null,
  amount: 250,
  transaction_date: "2026-09-19",
  competence_date: "2026-09-19",
  due_date: "2026-09-19",
  tags: [],
  attachments: [],
  duplicate_hash: null,
  is_historical: false,
  quantity: null,
  unit_price: null,
  external_ref: null,
  created_at: "2026-09-19T00:00:00Z",
  updated_at: "2026-09-19T00:00:00Z",
  deleted_at: null,
  ...over,
});

describe("Conciliação de compromissos", () => {
  it("encontra despesa compatível por conta, valor e janela de vencimento", () => {
    const candidates = CommitmentServiceImpl.findMovementCandidates(
      installment,
      commitment,
      [movement({})],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].movement.id).toBe("m1");
    expect(candidates[0].dayDiff).toBe(1);
    expect(candidates[0].amountDiff).toBe(0);
  });

  it("não sugere outra conta, valor diferente ou lançamento já vinculado", () => {
    const result = CommitmentServiceImpl.findMovementCandidates(
      installment,
      commitment,
      [
        movement({ id: "other-account", account_id: "account-2" }),
        movement({ id: "wrong-value", amount: 249.99 }),
        movement({ id: "linked" }),
      ],
      new Set(["linked"]),
    );
    expect(result).toHaveLength(0);
  });

  it("não cria movimento: a conciliação trabalha apenas sobre a lista de candidatos", () => {
    const candidates = CommitmentServiceImpl.findMovementCandidates(
      installment,
      commitment,
      [movement({})],
    );
    expect(candidates[0].movement.type).toBe(MovementType.EXPENSE);
  });
});
