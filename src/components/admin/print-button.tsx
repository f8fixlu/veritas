"use client";

export default function PrintButton({
  label = "Print report",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn btn-primary print:hidden"
    >
      {label}
    </button>
  );
}
