import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMovementFilters } from "../useMovementFilters";
import { firstDayOfMonth, lastDayOfMonth, toISODate } from "@/lib/format";

describe("useMovementFilters", () => {
  const defaultFrom = toISODate(firstDayOfMonth());
  const defaultTo = toISODate(lastDayOfMonth());

  it("returns default filters when no search params are provided", () => {
    const { result } = renderHook(() => useMovementFilters({}));

    expect(result.current.search).toBe("");
    expect(result.current.from).toBe(defaultFrom);
    expect(result.current.to).toBe(defaultTo);
    expect(result.current.accountId).toBe("all");
    expect(result.current.cardId).toBe("all");
    expect(result.current.categoryId).toBe("all");
    expect(result.current.subcategoryId).toBe("all");
    expect(result.current.type).toBe("all");
    expect(result.current.status).toBe("all");
    expect(result.current.group).toBe("all");
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("clears all filters and restores defaults", () => {
    const { result } = renderHook(() => useMovementFilters({}));

    act(() => {
      result.current.setSearch("mercado");
      result.current.setFrom("2026-01-01");
      result.current.setTo("2026-01-31");
      result.current.setAccountId("acc-1");
      result.current.setCardId("card-1");
      result.current.setCategoryId("cat-1");
      result.current.setSubcategoryId("sub-1");
      result.current.setType("EXPENSE");
      result.current.setStatus("PENDING");
      result.current.setGroup("expense");
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.search).toBe("");
    expect(result.current.from).toBe(defaultFrom);
    expect(result.current.to).toBe(defaultTo);
    expect(result.current.accountId).toBe("all");
    expect(result.current.cardId).toBe("all");
    expect(result.current.categoryId).toBe("all");
    expect(result.current.subcategoryId).toBe("all");
    expect(result.current.type).toBe("all");
    expect(result.current.status).toBe("all");
    expect(result.current.group).toBe("all");
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("updates the derived filters object when clearing filters", () => {
    const { result } = renderHook(() => useMovementFilters({}));

    act(() => {
      result.current.setSearch("uber");
      result.current.setAccountId("acc-2");
      result.current.setGroup("expense");
    });

    expect(result.current.filters).toEqual(
      expect.objectContaining({
        search: "uber",
        accountId: "acc-2",
        group: "expense",
      }),
    );

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual({
      from: defaultFrom,
      to: defaultTo,
      accountId: undefined,
      cardId: undefined,
      categoryId: undefined,
      subcategoryId: undefined,
      type: undefined,
      status: undefined,
      group: undefined,
      search: undefined,
    });
  });

  it("reports no active filters after clearing even when search params were initially present", () => {
    const { result } = renderHook(() =>
      useMovementFilters({
        account: "acc-3",
        category: "cat-3",
        subcategory: "sub-3",
        from: "2026-02-01",
        to: "2026-02-28",
      }),
    );

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.accountId).toBe("all");
    expect(result.current.categoryId).toBe("all");
    expect(result.current.subcategoryId).toBe("all");
    expect(result.current.from).toBe(defaultFrom);
    expect(result.current.to).toBe(defaultTo);
  });

  it("keeps the totalizador input in sync with the cleared filter set", () => {
    const { result } = renderHook(() => useMovementFilters({}));

    act(() => {
      result.current.setType("INCOME");
      result.current.setGroup("income");
    });

    // Antes de limpar, o filtro restringe a receitas.
    expect(result.current.filters.type).toBe("INCOME");
    expect(result.current.filters.group).toBe("income");

    act(() => {
      result.current.clearFilters();
    });

    // Após limpar, o totalizador deve considerar todas as movimentações do mês.
    expect(result.current.filters.type).toBeUndefined();
    expect(result.current.filters.group).toBeUndefined();
    expect(result.current.filters.from).toBe(defaultFrom);
    expect(result.current.filters.to).toBe(defaultTo);
  });
});
