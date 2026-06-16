function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-background/70 p-3 text-center">
      <p className="mb-0.5 text-[11px] text-muted-foreground">{label}</p>
      <p className="text-[12px] font-medium text-foreground">{value}</p>
    </div>
  );
}

export { MetaCard };
