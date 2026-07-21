export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Esta página será implementada em uma sprint futura.
      </p>
    </div>
  );
}
