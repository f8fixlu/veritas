"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import QuestionEditModal, {
  type EditableQuestion,
} from "@/components/admin/question-edit-modal";

export default function EditQuestionButton({
  question,
  sections,
}: {
  question: EditableQuestion;
  sections: { id: number; name: string; pointsPerQuestion: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
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
