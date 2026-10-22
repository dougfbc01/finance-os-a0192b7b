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
- Historical charts consume a read-only monthly per-asset ledger projected by the existing investment services at each asset's first stored session of the month (weekday reference if no session is stored), retaining actual quote dates and stale-price status; complete values require same-currency coverage, partial values include only evidenced positions and closed positions count as zero, because missing evidence must not masquerade as complete wealth or future prices.
- The history provider may cap ranges by plan; on INVALID_RANGE fetch the largest allowed real range and report the limit, and complete stored history only on explicit request, because older dates must stay gaps rather than invented prices.
- Historical analysis reports missing valuation, unavailable prices and indeterminate cost separately; comparisons filter return series while composition retains the full currency portfolio, because missing basis must not become invented profitability or misleading allocation percentages.
- Investment view helpers filter/sort existing rows and sanitize chart series without financial recalculation; use monthly ledger identities to explain coverage changes and render partial wealth as disconnected points, because newly evidenced positions are not investment gains. Unavailable numbers remain gaps and sort last in either direction.
- Investment distribution columns project registered income with event-identity deduplication independently of economic-return formulas; historical unquoted positions require valuation evidence, and isolated valid observations remain points with explicit limitations rather than interpolated lines.
- Confirm transfer pairs in one authenticated database transaction with row locks, version checks and the existing manual decision, because partial writes or stale confirmations can corrupt balances.
- Import guards include paginated active and soft-deleted hashes and revalidate before commit; retry conflicted batches per row, because stale previews and response caps must not resurrect deletions or discard new entries.
