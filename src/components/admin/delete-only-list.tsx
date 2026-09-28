import DeleteButton from "@/components/admin/delete-button";

/**
 * Admin-only view of subjects and exams. Admins cannot open, create or edit
 * this content — it exists so they can see what exists (and who owns it) in
 * order to delete it. Every row is a name and a delete button; there are no
 * links into the content itself.
 */
export default function DeleteOnlyList({
  items,
  noun,
}: {
  items: {
    id: number;
    name: string;
    detail: string;
    ownerName: string;
    confirmEndpoint: string;
    confirmText: string;
  }[];
  noun: "subject" | "exam";
}) {
  if (items.length === 0) {
    return (
      <div className="card p-12 text-center">
        <h2 className="text-base font-semibold text-slate-900">
          No {noun}s exist
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Instructors create and manage {noun}s from their own account.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.id} className="card card-soft px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-slate-900">
                {item.name}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {item.detail} · owned by {item.ownerName}
              </p>
            </div>
            <DeleteButton endpoint={item.confirmEndpoint} confirmText={item.confirmText} />
          </div>
        </li>
      ))}
    </ul>
  );
}
