"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import QuestionEditModal, {
  type EditableQuestion,
} from "@/components/admin/question-edit-modal";

export default function EditQuestionButton({
  question,
  sections,
  menuItem = false,
}: {
  question: EditableQuestion;
  sections: { id: number; name: string; pointsPerQuestion: number }[];
  menuItem?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={menuItem ? "menu-item" : "btn btn-secondary btn-sm"}
        onClick={() => setOpen(true)}
      >
        Edit
      </button>
      {open ? (
        <QuestionEditModal
          question={question}
          sections={sections}
          onClose={(saved?: boolean) => {
            setOpen(false);
            if (saved) router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
