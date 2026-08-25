"use client";

export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm no-print"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
