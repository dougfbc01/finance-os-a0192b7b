// Utilitários compartilhados entre importadores.

const MONTHS_PT: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

/** Converte "DD/MM/YYYY" ou "YYYY-MM-DD" para "yyyy-mm-dd". */
export function parseDate(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  // yyyy-mm-dd
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd/mm/yyyy
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // yyyymmdd (OFX)
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // dd-MMM-yyyy
  m = /^(\d{1,2})[-\s]([A-Za-zçÇ]{3})[-\s](\d{4})$/.exec(s);
  if (m) {
    const mm = MONTHS_PT[m[2].toLowerCase().slice(0, 3)];
    if (mm !== undefined)
      return `${m[3]}-${String(mm + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return null;
}

/** Converte valor BR ("-1.234,56") ou US ("1234.56") para número. */
export function parseAmount(input: string | number | undefined | null): number {
  if (typeof input === "number") return input;
  const s = String(input ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;
  if (hasComma && hasDot) {
    // formato BR: 1.234,56
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = s.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export function normalizeDescription(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hash determinístico para detecção de duplicidade.
 * Chave = workspace + account + data + valor + descrição normalizada.
 */
export function buildDuplicateHash(params: {
  workspaceId: string;
  accountId: string | null;
  date: string;
  amount: number;
  description: string;
  externalId?: string | null;
}): string {
  if (params.externalId) {
    return `wsp:${params.workspaceId}|acc:${params.accountId ?? ""}|ext:${params.externalId}`;
  }
  const desc = normalizeDescription(params.description);
  const amount = Math.abs(Number(params.amount)).toFixed(2);
  return `wsp:${params.workspaceId}|acc:${params.accountId ?? ""}|dt:${params.date}|amt:${amount}|desc:${desc}`;
}

/** Hash rápido do arquivo (djb2). Não é criptográfico, mas suficiente para deduplicar arquivos. */
export function fileHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
  }
  return `f${(h >>> 0).toString(16)}-${text.length}`;
}

/** Parser CSV mínimo com suporte a aspas e vírgula/ponto e vírgula. */
export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^\uFEFF/, "");
  const lines: string[] = [];
  {
    let cur = "";
    let inQ = false;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (ch === '"') {
        inQ = !inQ;
        cur += ch;
        continue;
      }
      if ((ch === "\n" || ch === "\r") && !inQ) {
        if (ch === "\r" && clean[i + 1] === "\n") i++;
        if (cur.length) lines.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    if (cur.length) lines.push(cur);
  }
  if (!lines.length) return [];

  const detectDelim = (line: string) =>
    line.split(";").length > line.split(",").length ? ";" : ",";
  const delim = detectDelim(lines[0]);

  const splitRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQ = !inQ;
        continue;
      }
      if (ch === delim && !inQ) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = splitRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (cells.every((c) => !c.length)) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}
