// TransactionFingerprintService — Sprint 4.1.1
// Gera um identificador padronizado (fingerprint) para descrições bancárias.
// Toda a normalização de texto do sistema deve passar por aqui: nenhum outro
// Service, Hook ou Component pode reimplementar essa lógica.

/** Ruídos comuns dos extratos brasileiros que não identificam o estabelecimento. */
const STOPWORDS = new Set([
  "compra",
  "compras",
  "pagamento",
  "pgto",
  "debito",
  "credito",
  "cartao",
  "cartão",
  "no",
  "na",
  "de",
  "do",
  "da",
  "em",
  "para",
  "por",
  "com",
  "the",
  "ltda",
  "me",
  "sa",
  "eireli",
  "mei",
  "brasil",
  "br",
  "bra",
  "parcela",
  "parc",
  "transferencia",
  "recebida",
  "enviada",
  "pix",
  "ted",
  "doc",
  "boleto",
  "mensalidade",
  "assinatura",
  "servico",
  "servicos",
  "loja",
  "mktplace",
  "marketplace",
  "market",
  "store",
  "online",
  "app",
  "www",
  "com.br",
]);

/** Marcas conhecidas cujo fingerprint deve colapsar em um único token. */
const BRAND_ALIASES: Array<{ test: RegExp; token: string }> = [
  { test: /\bamazon\b/, token: "AMAZON" },
  { test: /\buber\s*eats\b/, token: "UBER EATS" },
  { test: /\buber\b/, token: "UBER" },
  { test: /\bifd?ood\b|\bifood\b/, token: "IFOOD" },
  { test: /\bnetflix\b/, token: "NETFLIX" },
  { test: /\bspotify\b/, token: "SPOTIFY" },
  { test: /\brappi\b/, token: "RAPPI" },
  { test: /\b99\s*(app|pop|taxi)\b/, token: "99" },
  { test: /\bmercado\s*(livre|pago)\b/, token: "MERCADO LIVRE" },
  { test: /\bmercpago\b|\bmercadopago\b/, token: "MERCADO LIVRE" },
  { test: /\bgoogle\b/, token: "GOOGLE" },
  { test: /\bapple\b|\bitunes\b/, token: "APPLE" },
  { test: /\bposto\b/, token: "POSTO" },
  { test: /\bdrogaria|\bdroga\s?raia\b|\bdrogasil\b/, token: "DROGARIA" },
];

class TransactionFingerprintServiceImpl {
  /**
   * Limpeza básica: remove acentos, símbolos, números variáveis, hashes,
   * códigos e espaços duplicados. Resultado em caixa baixa.
   */
  normalize(input: string): string {
    return (input ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      // datas
      .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, " ")
      // parcelas: 03/12, 1 de 6
      .replace(/\b\d{1,2}\s*(de|\/)\s*\d{1,2}\b/g, " ")
      // hashes / ids alfanuméricos longos
      .replace(/\b(?=[a-z0-9]*\d)[a-z0-9]{6,}\b/g, " ")
      // números soltos
      .replace(/\d+/g, " ")
      // símbolos
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Tokens significativos (sem stopwords e com pelo menos 3 caracteres). */
  tokens(input: string): string[] {
    return this.normalize(input)
      .split(" ")
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  }

  /**
   * Fingerprint canônico em CAIXA ALTA.
   * "AMAZON MKTPLACE 938472" -> "AMAZON"
   * "UBER *TRIP 483829"      -> "UBER"
   * "IFOOD*83929"            -> "IFOOD"
   */
  build(description: string): string {
    const normalized = this.normalize(description);
    if (!normalized) return "";

    for (const alias of BRAND_ALIASES) {
      if (alias.test.test(normalized)) return alias.token;
    }

    const tokens = this.tokens(description);
    if (!tokens.length) {
      const fallback = normalized.split(" ").filter(Boolean);
      return fallback.slice(0, 2).join(" ").toUpperCase();
    }
    // Estabelecimentos são identificados pelos primeiros tokens relevantes.
    return tokens.slice(0, 2).join(" ").toUpperCase();
  }

  /** Fingerprint curto (apenas o token principal) — usado por regras genéricas. */
  root(description: string): string {
    const fp = this.build(description);
    return fp.split(" ")[0] ?? "";
  }

  /**
   * Extrai a contraparte (beneficiário/pagador) de descrições bancárias.
   * "Transferência enviada pelo Pix - MARIA DO CARMO - 123.456 - BANCO"
   *   -> "MARIA DO CARMO"
   * Quando não há separador, devolve o texto após os prefixos conhecidos.
   */
  counterparty(description: string): string {
    const raw = (description ?? "").replace(/\s+/g, " ").trim();
    if (!raw) return "";
    const parts = raw.split(/\s+[-–—]\s+|\s*\|\s*/).filter((p) => p.trim());
    let candidate = parts.length > 1 ? parts[1] : parts[0] ?? "";
    candidate = candidate
      .replace(
        /^(transfer[eê]ncia|pagamento|pix|ted|doc|compra|d[eé]bito|cr[eé]dito)\b[\s\w()çãáéíóúâêôõ]*?(?=\s[A-ZÀ-Ý]{2,}|$)/i,
        "",
      )
      .replace(/\b\d{2,}[\d.\-/]*\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return candidate;
  }

  /** Contraparte normalizada (comparação de regras). */
  counterpartyKey(description: string): string {
    return this.normalize(this.counterparty(description));
  }


  /** Similaridade textual 0..1 (coeficiente de Dice sobre tokens). */
  textSimilarity(a: string, b: string): number {
    const ta = new Set(this.tokens(a));
    const tb = new Set(this.tokens(b));
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return (2 * inter) / (ta.size + tb.size);
  }
}

export const TransactionFingerprintService = new TransactionFingerprintServiceImpl();
export { TransactionFingerprintServiceImpl };
