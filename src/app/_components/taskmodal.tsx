"use client";

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

enum TaskStatus {
  ToDo = "To Do",
  InProgress = "In Progress",
  Completed = "Completed",
}

enum TaskPriority {
  Highest = "1",
  High = "2",
  Medium = "3",
  Low = "4",
  Lowest = "5",
}

interface TaskModalProps {
  taskId: number;
  onClose: () => void;
}

export function TaskModal({ taskId, onClose }: TaskModalProps) {
  const [task] = api.tasks.getTask.useSuspenseQuery({
    taskId,
  });

  const [assignedDocument, setAssignedDocument] = useState<any>(null);

  useEffect(() => {
    if (task?.documentId) {
      const fetchedDocument = api.document.getDocument.useSuspenseQuery({
        documentId: task?.documentId || 0,
      });
      setAssignedDocument(fetchedDocument);
    } else {
      setAssignedDocument(null);
    }
  }, [task]);

  const [documents] = api.project.getDocuments.useSuspenseQuery({
    projectId: task?.projectId || 0,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.ToDo);
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.Medium);
  const [policyHeader, setPolicyHeader] = useState("");
  const [policyContent, setPolicyContent] = useState("");
  const [recommendedContent, setRecommendedContent] = useState("");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentLink, setDocumentLink] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus((task.status as TaskStatus) || TaskStatus.ToDo);
      setPriority((task.priority as TaskPriority) || TaskPriority.Medium);
      setPolicyHeader(task.policyHeader || "");
      setPolicyContent(task.policyContent || "");
      setRecommendedContent(task.recommendedContent || "");
      setDocumentId(task.documentId || null);
    }
  }, [task]);

  useEffect(() => {
    if (assignedDocument) {
      setDocumentTitle(assignedDocument?.[0]?.title || "");
      setDocumentLink(assignedDocument?.[0]?.fileUrl || "");
    } else {
      setDocumentTitle("");
      setDocumentLink("");
    }
  }, [assignedDocument]);

  const utils = api.useUtils();
  const editTask = api.tasks.editTask.useMutation({
    onSuccess: async () => {
      await utils.tasks.invalidate();
      onClose();
    },
  });

  const deleteTask = api.tasks.deleteTask.useMutation({
    onSuccess: async () => {
      await utils.tasks.invalidate();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Edit Task</h2>
        <div className="flex flex-col gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task Title"
            className="w-full rounded border p-2"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Task Description"
            className="w-full rounded border p-2"
          />

          <select
            className="w-full rounded border p-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          <select
            className="w-full rounded border p-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option value="1">1 (Highest)</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5 (Lowest)</option>
          </select>

          <input
            type="text"
            value={policyHeader}
            onChange={(e) => setPolicyHeader(e.target.value)}
            placeholder="Policy Header"
            className="w-full rounded border p-2"
          />

          <textarea
            value={policyContent}
            onChange={(e) => setPolicyContent(e.target.value)}
            placeholder="Policy Content"
            className="w-full rounded border p-2"
          />

          <textarea
            value={recommendedContent}
            onChange={(e) => setRecommendedContent(e.target.value)}
            placeholder="Recommended Content"
            className="w-full rounded border p-2"
          />

          <div>
            <p className="text-sm font-medium">
              Selected Document: {documentTitle || "None"}
            </p>
            <p
              className="cursor-pointer text-blue-600 underline"
              onClick={() =>
                documentLink && window.open(documentLink, "_blank")
              }
            >
              {documentLink ? "Open Document" : "No Document Selected"}
            </p>
          </div>

          {}
          <select
            className="w-full rounded border p-2"
            onChange={(e) => {
              const selectedDoc = documents?.find(
                (doc) => doc.id === Number(e.target.value),
              );
              if (selectedDoc) {
                setDocumentId(selectedDoc.id);
                setDocumentTitle(selectedDoc.title);
                setDocumentLink(selectedDoc.fileUrl || "");
              }
            }}
          >
            <option value="">Select a Document</option>
            {documents?.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>
        </div>

        {}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              if (task) {
                editTask.mutate({
                  id: task.id,
                  title,
                  description,
                  status,
                  priority,
                  policyHeader,
                  policyContent,
                  recommendedContent,
                  documentIds: documentId ?? 0,
                });
              }
            }}
            disabled={editTask.isPending}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {editTask.isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              if (task) {
                deleteTask.mutate({ id: task.id });
              }
            }}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="rounded bg-gray-300 px-4 py-2 hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
