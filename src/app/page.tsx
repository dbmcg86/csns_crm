import { IntakeForm } from "@/components/intake-form";

export default function Page() {
  return (
    <main className="flex-1 w-full">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-semibold text-[11px] shadow-sm">
              CnS
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-sm tracking-tight">
                Central Service &amp; Supply
              </div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">
                Customer Intake
              </div>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground border rounded-full px-2 py-0.5">
            Stopgap
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <IntakeForm />
      </div>
    </main>
  );
}
