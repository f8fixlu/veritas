"use client";

import { Button } from "@/app/ui";

export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="no-print"
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}
