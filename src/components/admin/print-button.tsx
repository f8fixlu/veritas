"use client";

import { Button } from "@/app/ui";
import { IconPrinter } from "@/components/icons";

export default function PrintButton({
  label = "Print report",
}: {
  label?: string;
}) {
  return (
    <Button
      variant="primary"
      className="print:hidden"
      aria-label={label}
      onClick={() => window.print()}
    >
      <IconPrinter />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
