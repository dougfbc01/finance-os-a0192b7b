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
