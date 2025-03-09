"use client";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { TaskModal } from "~/app/_components/taskmodal";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DroppableProvided,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DroppableStateSnapshot,
} from "react-beautiful-dnd";
import { MemberManagement } from "~/app/_components/member-management";
import {
  ChevronDownIcon,
  PlusIcon,
  DocumentIcon,
  UserGroupIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";

interface Task {
  id: number;
  title: string;
  description: string;
  createdBy: string;
  order: number;
}

interface Milestone {
  id: number;
  title: string;
  description: string;
  dueDate: string;
  tasks: Task[];
}

interface Document {
  id: number;
  title: string;
  fileUrl: string | null;
}

interface Project {
  id: number;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
}

const ProjectDetailsPage: React.FC = () => {
  const params = useParams();
  const projectId = params.projectId ? Number(params.projectId) : null;
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [newDocumentTitle, setNewDocumentTitle] = useState("");
  const [newDocumentUrl, setNewDocumentUrl] = useState("");

  const [activeTab, setActiveTab] = useState("milestones");

  useEffect(() => {
    if (selectedTaskId !== null) {
      console.log("Selected Task ID:", selectedTaskId);
    }
  }, [selectedTaskId]);

  const { data: project, isLoading, error } = api.project.getProjectDetails.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  ) as { data: Project | undefined; isLoading: boolean; error: Error | null };

  const { data: milestones = [], refetch: refetchMilestones } = api.details.getMilestones.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  ) as { data: Milestone[]; refetch: () => Promise<unknown> };

  const { data: documents = [], refetch: refetchDocuments } = api.project.getDocuments.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  ) as { data: Document[]; refetch: () => Promise<unknown> };

  const updateTaskMutation = api.details.updateTask.useMutation({
    onSuccess: () => {
      void refetchMilestones();
    },
    onError: (error) => {
      console.error("Error updating task:", error);
      alert("Failed to update task. Please try again.");
    },
  });

  const reorderTasksMutation = api.details.reorderTasks.useMutation({
    onSuccess: () => {
      void refetchMilestones();
    },
    onError: (error) => {
      console.error("Error reordering tasks:", error);
      alert("Failed to reorder tasks. Please try again.");
    },
  });

  const addMilestoneMutation = api.details.createMilestone.useMutation({
    onSuccess: () => {
      void refetchMilestones();
      setShowMilestoneModal(false);
    },
  });

  const addTaskMutation = api.details.createTask.useMutation({
    onSuccess: (data) => {
      void refetchMilestones();
      if (data) {
        setSelectedTaskId(data.id);
      }
    },
  });

  const addDocumentMutation = api.project.assignDocument.useMutation({
    onSuccess: () => {
      void refetchDocuments();
      setShowDocumentModal(false);
    },
  });

  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDescription, setNewMilestoneDescription] = useState("");
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);

  if (isLoading)
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  if (error)
    return (
      <div className="flex justify-center items-center h-screen">Error: {error.message}</div>
    );
  if (!project)
    return <div className="flex justify-center items-center h-screen">Project not found</div>;

  const handleAddMilestone = () => {
    if (!projectId) return;

    addMilestoneMutation.mutate({
      projectId,
      title: newMilestoneTitle,
      description: newMilestoneDescription,
      dueDate: new Date(newMilestoneDueDate),
    });
  };

  const handleAddTask = (milestoneId: number, tasksCount: number) => {
    if (!projectId) return;

    addTaskMutation.mutate(
      {
        projectId,
        milestoneId,
        title: "",
        createdBy: project.createdBy,
        order: tasksCount,
      },
      {
        onSuccess: (data) => {
          if (data?.id) {
            setSelectedTaskId(data.id);
          }
          void refetchMilestones();
        },
      }
    );
  };

  const handleAddDocument = () => {
    if (!projectId) return;

    addDocumentMutation.mutate({
      title: newDocumentTitle,
      fileUrl: newDocumentUrl,
      projectId,
    });
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) {
      const milestone = milestones.find((m) => m.id.toString() === source.droppableId);
      if (!milestone) return;

      const tasks = [...milestone.tasks];
      const [movedTask] = tasks.splice(source.index, 1);
      if (movedTask) {
        tasks.splice(destination.index, 0, movedTask);

        reorderTasksMutation.mutate({
          milestoneId: milestone.id,
          tasks: tasks.map((task) => task.id),
        });
      }
    } else {
      const taskId = parseInt(draggableId);
      const destinationMilestoneId = parseInt(destination.droppableId);

      if (isNaN(taskId) || isNaN(destinationMilestoneId)) return;

      updateTaskMutation.mutate({
        taskId,
        milestoneId: destinationMilestoneId,
      });
    }
  };

  const sidebar = (
    <div className="bg-white rounded-lg shadow p-6 mb-6 md:mb-0">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Project Info</h3>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500">CREATED</label>
          <p className="mt-1 flex items-center text-sm text-gray-900">
            <ClockIcon className="h-4 w-4 mr-1 text-gray-400" />
            {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : ""}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">DOCUMENTS</label>
          <ul className="mt-2 space-y-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.fileUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <DocumentIcon className="h-4 w-4 mr-2" />
                  {doc.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <p className="mt-1 text-sm text-gray-500">{project.description}</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowDocumentModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <DocumentIcon className="h-5 w-5 mr-2 text-gray-500" />
                  Add Document
                </button>
                <button
                  onClick={() => setShowMilestoneModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  New Milestone
                </button>
              </div>
            </div>

            {}
            <div className="mt-6 border-t border-gray-200">
              <nav className="flex space-x-4 overflow-x-auto mt-4">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === "overview"
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent"
                    } hover:text-gray-700 hover:border-gray-300`}
                >
                  <ChartBarIcon className="h-5 w-5 inline-block mr-2" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab("milestones")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === "milestones"
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent"
                    } hover:text-gray-700 hover:border-gray-300`}
                >
                  <FlagIcon className="h-5 w-5 inline-block mr-2" />
                  Milestones
                </button>
                <button
                  onClick={() => setActiveTab("team")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === "team"
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent"
                    } hover:text-gray-700 hover:border-gray-300`}
                >
                  <UserGroupIcon className="h-5 w-5 inline-block mr-2" />
                  Team
                </button>
                <button
                  onClick={() => setActiveTab("documents")}
                  className={`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === "documents"
                      ? "text-blue-600 border-blue-600"
                      : "text-gray-500 border-transparent"
                    } hover:text-gray-700 hover:border-gray-300`}
                >
                  <DocumentIcon className="h-5 w-5 inline-block mr-2" />
                  Documents
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && (
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64">{sidebar}</div>
            <div className="flex-1 bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Project Overview</h2>
              <p className="text-gray-700">{project.description}</p>
              {}
            </div>
          </div>
        )}

        {activeTab === "milestones" && (
          <div className="flex flex-col md:flex-row gap-8">
            <div className="w-full md:w-64">{sidebar}</div>
            <div className="flex-1">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {milestones.length ? (
                    milestones.map((milestone: Milestone) => (
                      <Droppable 
                        key={milestone.id} 
                        droppableId={milestone.id.toString()} 
                        isDropDisabled={false}
                        isCombineEnabled={false}
                      >
                        {(
                          provided: DroppableProvided,
                          snapshot: DroppableStateSnapshot
                        ) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`bg-white rounded-lg shadow-sm ${snapshot.isDraggingOver ? "ring-2 ring-blue-400" : ""
                              }`}
                          >
                            <div className="p-4 border-b">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-gray-900">
                                  {milestone.title}
                                </h3>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {milestone.tasks.length} tasks
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mb-2">
                                {milestone.description}
                              </p>
                              <div className="flex items-center text-xs text-gray-500">
                                <CalendarIcon className="h-4 w-4 mr-1" />
                                Due {new Date(milestone.dueDate).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="space-y-2">
                                {milestone.tasks.map((task: Task, taskIndex: number) => (
                                  <Draggable
                                    key={task.id}
                                    draggableId={task.id.toString()}
                                    index={taskIndex}
                                    isDragDisabled={false}
                                  >
                                    {(
                                      provided: DraggableProvided,
                                      snapshot: DraggableStateSnapshot
                                    ) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`p-3 rounded-md bg-white border ${snapshot.isDragging
                                            ? "shadow-lg ring-2 ring-blue-400"
                                            : "hover:bg-gray-50"
                                          }`}
                                        onClick={() => setSelectedTaskId(task.id)}
                                      >
                                        <h4 className="font-medium text-gray-900">
                                          {task.title || "Untitled Task"}
                                        </h4>
                                        {task.description && (
                                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                            {task.description}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedMilestoneId(milestone.id);
                                  handleAddTask(milestone.id, milestone.tasks.length);
                                }}
                                className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                              >
                                <PlusIcon className="h-4 w-4 mr-1" />
                                Add Task
                              </button>
                            </div>
                          </div>
                        )}
                      </Droppable>
                    ))
                  ) : (
                    <div className="col-span-3 flex flex-col items-center justify-center py-12 bg-white rounded-lg border-2 border-dashed">
                      <FlagIcon className="h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No milestones
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Get started by creating a new milestone.
                      </p>
                      <button
                        onClick={() => setShowMilestoneModal(true)}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        New Milestone
                      </button>
                    </div>
                  )}
                </div>
              </DragDropContext>
            </div>
          </div>
        )}

        {activeTab === "team" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Team Members</h2>
            <MemberManagement projectId={projectId!} />
          </div>
        )}

        {activeTab === "documents" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Documents</h2>
              <button
                onClick={() => setShowDocumentModal(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <DocumentIcon className="h-5 w-5 mr-2 text-gray-500" />
                Add Document
              </button>
            </div>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <a
                    href={doc.fileUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                  >
                    <DocumentIcon className="h-4 w-4 mr-2" />
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {}
      {showMilestoneModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">New Milestone</h2>
              <button
                onClick={() => setShowMilestoneModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="milestone-title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="milestone-title"
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter milestone title"
                />
              </div>
              <div>
                <label
                  htmlFor="milestone-description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="milestone-description"
                  value={newMilestoneDescription}
                  onChange={(e) => setNewMilestoneDescription(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter milestone description"
                />
              </div>
              <div>
                <label
                  htmlFor="milestone-due-date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Due Date
                </label>
                <input
                  type="date"
                  id="milestone-due-date"
                  value={newMilestoneDueDate}
                  onChange={(e) => setNewMilestoneDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowMilestoneModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMilestone}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Create Milestone
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Add Document</h2>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="document-title"
                  className="block text-sm font-medium text-gray-700"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="document-title"
                  value={newDocumentTitle}
                  onChange={(e) => setNewDocumentTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter document title"
                />
              </div>
              <div>
                <label
                  htmlFor="document-url"
                  className="block text-sm font-medium text-gray-700"
                >
                  URL
                </label>
                <input
                  type="text"
                  id="document-url"
                  value={newDocumentUrl}
                  onChange={(e) => setNewDocumentUrl(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Enter document URL"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowDocumentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDocument}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Document
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {selectedTaskId && (
        <TaskModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </div>
  );
};

export default ProjectDetailsPage;
