import { useEffect, useMemo, useState } from "react";
import type { MovementFilters, MovementGroup, MovementType, MovementStatus } from "@/models";
import { firstDayOfMonth, lastDayOfMonth, toISODate } from "@/lib/format";

const ALL = "all";
const NO_CATEGORY = "none";
const DEFAULT_GROUP: MovementGroup = "all";

interface SearchParams {
  account?: string;
  category?: string;
  subcategory?: string;
  from?: string;
  to?: string;
}

export function useMovementFilters(searchParams: SearchParams) {
  const defaultFrom = toISODate(firstDayOfMonth());
  const defaultTo = toISODate(lastDayOfMonth());

  const [from, setFrom] = useState(searchParams.from ?? defaultFrom);
  const [to, setTo] = useState(searchParams.to ?? defaultTo);
  const [accountId, setAccountId] = useState<string>(searchParams.account ?? ALL);
  const [cardId, setCardId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(
    searchParams.category === "null" ? NO_CATEGORY : (searchParams.category ?? ALL),
  );
  const [subcategoryId, setSubcategoryId] = useState<string>(searchParams.subcategory ?? ALL);
  const [type, setType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [group, setGroup] = useState<MovementGroup>(DEFAULT_GROUP);
  const [search, setSearch] = useState("");

  // Preserva o filtro quando o usuário chega vindo de "Ver extrato" na Conta.
  useEffect(() => {
    if (searchParams.account) setAccountId(searchParams.account);
  }, [searchParams.account]);

  // Deep link vindo dos Financial Insights (ex.: category=null -> sem categoria).
  useEffect(() => {
    if (searchParams.category)
      setCategoryId(searchParams.category === "null" ? NO_CATEGORY : searchParams.category);
  }, [searchParams.category]);

  // Drill down vindo do Planejamento Mensal (categoria/subcategoria + período).
  useEffect(() => {
    if (searchParams.subcategory) setSubcategoryId(searchParams.subcategory);
  }, [searchParams.subcategory]);
  useEffect(() => {
    if (searchParams.from) setFrom(searchParams.from);
    if (searchParams.to) setTo(searchParams.to);
  }, [searchParams.from, searchParams.to]);

  const hasActiveFilters = useMemo(
    () =>
      search.trim() !== "" ||
      from !== defaultFrom ||
      to !== defaultTo ||
      accountId !== ALL ||
      cardId !== ALL ||
      categoryId !== ALL ||
      subcategoryId !== ALL ||
      type !== ALL ||
      status !== ALL ||
      group !== DEFAULT_GROUP,
    [search, from, to, defaultFrom, defaultTo, accountId, cardId, categoryId, subcategoryId, type, status, group],
  );

  const clearFilters = () => {
    setSearch("");
    setFrom(defaultFrom);
    setTo(defaultTo);
    setAccountId(ALL);
    setCardId(ALL);
    setCategoryId(ALL);
    setSubcategoryId(ALL);
    setType(ALL);
    setStatus(ALL);
    setGroup(DEFAULT_GROUP);
  };

  const filters: MovementFilters = useMemo(
    () => ({
      from,
      to,
      accountId: accountId === ALL ? undefined : accountId,
      cardId: cardId === ALL ? undefined : cardId,
      categoryId: categoryId === ALL ? undefined : categoryId,
      subcategoryId: subcategoryId === ALL ? undefined : subcategoryId,
      type: type === ALL ? undefined : (type as MovementType),
      status: status === ALL ? undefined : (status as MovementStatus),
      group: group === "all" ? undefined : group,
      search: search.trim() || undefined,
    }),
    [from, to, accountId, cardId, categoryId, subcategoryId, type, status, group, search],
  );

  return {
    from,
    setFrom,
    to,
    setTo,
    accountId,
    setAccountId,
    cardId,
    setCardId,
    categoryId,
    setCategoryId,
    subcategoryId,
    setSubcategoryId,
    type,
    setType,
    status,
    setStatus,
    group,
    setGroup,
    search,
    setSearch,
    filters,
    hasActiveFilters,
    clearFilters,
  };
}
