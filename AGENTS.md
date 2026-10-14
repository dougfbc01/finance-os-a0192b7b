<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Represent B3 historical cost provenance with `cost:CARRIED`, `cost:BASIS:<value>`, `cost:LEGACY_COVERED`, and `cost:INDETERMINATE` movement tags, because quantity adjustments must remain cash-neutral and conversion cost must never be inferred.
- Persist the latest quote per asset in `market_price_history` (one row per asset/day) and only query the provider on explicit user request, because refreshing one asset must never clear or change other assets' quotes.
- Investment analysis is a read-only projection through the existing valuation, quotation and investment services, grouped by asset type and currency; use stored prices at or before each date and leave unavailable historical valuations as gaps, because analysis must not introduce financial formulas, future prices or cross-currency sums.
- Historical analysis reports missing valuation, unavailable prices and indeterminate cost separately; comparisons filter return series while composition retains the full currency portfolio, because missing basis must not become invented profitability or misleading allocation percentages.
- Investment view helpers filter/sort existing rows and sanitize chart series without financial recalculation; unavailable numbers remain gaps and sort last in either direction, because presentation must never invent financial values.
- Confirm transfer pairs in one authenticated database transaction with row locks, version checks and the existing manual decision, because partial writes or stale confirmations can corrupt balances.
- Import guards include paginated active and soft-deleted hashes and revalidate before commit; retry conflicted batches per row, because stale previews and response caps must not resurrect deletions or discard new entries.
