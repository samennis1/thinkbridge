"use client";

import React, { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChartBarIcon, 
  ClockIcon, 
  DocumentIcon, 
  FlagIcon, 
  UserGroupIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  FireIcon
} from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface ActivityItem {
  id: number;
  user: string;
  userImage?: string | null;
  action: string;
  project: string;
  projectId?: number;
  time: string;
  details?: string | Record<string, unknown>;
  entityType?: "project" | "milestone" | "task" | "document" | "member";
  entityId?: number | null;
}

interface DeadlineItem {
  id: number;
  name: string;
  project: string;
  projectId: number;
  date: string;
  status: "On Track" | "At Risk" | "Completed";
}

interface ProjectStats {
  totalProjects: number;
  activeMilestones: number;
  teamMembers: number;
  completedTasks: number;
}

interface MilestoneData {
  id: number;
  title?: string;
  name?: string;
  dueDate?: string | Date;
  status?: "Completed" | "Planned" | "In Progress" | null;
  projectId: number;
}

interface ApiActivityItem {
  id?: number;
  user?: string;
  userImage?: string | null;
  action?: string;
  project?: string;
  projectName?: string;
  projectId?: number;
  time?: string;
  timeAgo?: string;
  details?: string | Record<string, unknown>;
  entityType?: "project" | "milestone" | "task" | "document" | "member";
  entityId?: number | null;
}

const Dashboard = () => {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStats>({
    totalProjects: 0,
    activeMilestones: 0,
    teamMembers: 0,
    completedTasks: 0
  });
  
  const { data: projects, isLoading: projectsLoading } = api.project.getAll.useQuery(undefined, {
    enabled: !!session,
  });
  
  const { data: recentActivity, isLoading: activityLoading } = api.project.getRecentActivity.useQuery(undefined, {
    enabled: !!session,
  });

  useEffect(() => {
    if (projects) {
      const activeMilestones = projects.reduce((total, project) => {
        return total + (project.milestones?.length || 0);
      }, 0);
      
      const memberIds = new Set<string>();
      projects.forEach(project => {
        project.members?.forEach(member => {
          if (member.userId) {
            memberIds.add(member.userId);
          }
        });
      });
      
      const completedTasks = projects.reduce((total, project) => {
        return total + (project.completedTasksCount || 0);
      }, 0);
      
      setStats({
        totalProjects: projects.length,
        activeMilestones,
        teamMembers: memberIds.size,
        completedTasks
      });
      
      setIsLoading(false);
    }
  }, [projects]);

  const statCards = [
    { 
      name: 'Total Projects', 
      value: stats.totalProjects, 
      icon: <DocumentIcon className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-50 text-blue-600'
    },
    { 
      name: 'Active Milestones', 
      value: stats.activeMilestones,
      icon: <FlagIcon className="h-6 w-6 text-indigo-600" />,
      color: 'bg-indigo-50 text-indigo-600'
    },
    { 
      name: 'Team Members', 
      value: stats.teamMembers,
      icon: <UserGroupIcon className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-50 text-purple-600'
    },
    { 
      name: 'Completed Tasks', 
      value: stats.completedTasks,
      icon: <CheckCircleIcon className="h-6 w-6 text-green-600" />,
      color: 'bg-green-50 text-green-600'
    },
  ];

  const upcomingDeadlines: DeadlineItem[] = React.useMemo(() => {
    if (!projects) return [];
    
    const deadlines: DeadlineItem[] = [];
    
    projects.forEach(project => {
      if (project.milestones && Array.isArray(project.milestones)) {
        project.milestones.forEach(milestone => {
          const typedMilestone = milestone as unknown as MilestoneData;
          
          if (!typedMilestone.dueDate) return;
          
          const dueDate = new Date(typedMilestone.dueDate);
          const today = new Date();
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          let status: "On Track" | "At Risk" | "Completed" = "On Track";
          if (typedMilestone.status === "Completed") {
            status = "Completed";
          } else if (diffDays < 3) {
            status = "At Risk";
          }
          
          const milestoneName = typedMilestone.name ?? typedMilestone.title ?? "Unnamed Milestone";
          
          deadlines.push({
            id: typedMilestone.id,
            name: milestoneName,
            project: project.name,
            projectId: project.id,
            date: typeof typedMilestone.dueDate === 'string' ? typedMilestone.dueDate : typedMilestone.dueDate.toISOString(),
            status
          });
        });
      }
    });
    
    return deadlines
      .filter(d => d.status !== "Completed")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [projects]);

  const activities: ActivityItem[] = React.useMemo(() => {
    if (!recentActivity || !Array.isArray(recentActivity)) return [];
    
    return recentActivity.map(item => {
      const activity = item as unknown as ApiActivityItem;
      
      return {
        id: activity.id ?? 0,
        user: activity.user ?? 'Unknown User',
        action: activity.action ?? 'performed an action',
        project: activity.project ?? activity.projectName ?? 'Unknown Project',
        time: activity.time ?? activity.timeAgo ?? 'Recently',
        userImage: activity.userImage,
        projectId: activity.projectId,
        details: activity.details,
        entityType: activity.entityType,
        entityId: activity.entityId
      };
    });
  }, [recentActivity]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-center md:justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, {session?.user?.name ?? 'User'}! Here&apos;s what&apos;s happening with your projects.
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              View All Projects
            </Link>
          </div>
        </motion.div>

        {}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8"
        >
          {statCards.map((stat) => (
            <motion.div 
              key={stat.name} 
              variants={itemVariants}
              className="bg-white overflow-hidden shadow rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-md p-3 ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                      <dd>
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                          className="text-lg font-medium text-gray-900"
                        >
                          {isLoading ? (
                            <div className="h-6 w-12 bg-gray-200 rounded animate-pulse"></div>
                          ) : (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              key={stat.value}
                            >
                              {stat.value}
                            </motion.span>
                          )}
                        </motion.div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white shadow rounded-lg overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <ArrowTrendingUpIcon className="h-5 w-5 mr-2 text-blue-500" />
                Project Progress
              </h3>
              <div className="mt-6 space-y-6">
                {projectsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                ) : projects && projects.length > 0 ? (
                  <AnimatePresence>
                    {projects.slice(0, 3).map((project, index) => (
                      <motion.div 
                        key={project.id} 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Link href={`/project/${project.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                            {project.name}
                          </Link>
                          <span className="text-xs text-gray-500">
                            {project.completionPercentage ?? 0}% Complete
                          </span>
                        </div>
                        <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${project.completionPercentage ?? 0}%` }}
                            transition={{ duration: 1, delay: 0.5 + index * 0.2 }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                          ></motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <p className="text-gray-500 text-sm">No projects found. Create your first project to track progress.</p>
                )}
              </div>
              <div className="mt-6">
                <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  View all projects
                </Link>
              </div>
            </div>
          </motion.div>

          {}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white shadow rounded-lg overflow-hidden"
          >
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <CalendarIcon className="h-5 w-5 mr-2 text-blue-500" />
                Upcoming Deadlines
              </h3>
              <div className="mt-6 flow-root">
                {projectsLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-gray-200 rounded w-full"></div>
                    <div className="h-16 bg-gray-200 rounded w-full"></div>
                    <div className="h-16 bg-gray-200 rounded w-full"></div>
                  </div>
                ) : (
                  <ul className="-my-5 divide-y divide-gray-200">
                    <AnimatePresence>
                      {upcomingDeadlines.length > 0 ? (
                        upcomingDeadlines.map((deadline, index) => (
                          <motion.li 
                            key={deadline.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="py-4"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full ${
                                  deadline.status === 'On Track' ? 'bg-green-100' : 'bg-red-100'
                                }`}>
                                  {deadline.status === 'On Track' ? (
                                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <ExclamationCircleIcon className="h-5 w-5 text-red-600" />
                                  )}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {deadline.name}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                  <Link href={`/project/${deadline.projectId}`} className="hover:text-blue-600">
                                    {deadline.project}
                                  </Link>
                                </p>
                              </div>
                              <div className="flex-shrink-0 whitespace-nowrap text-sm text-gray-500">
                                Due {new Date(deadline.date).toLocaleDateString()}
                              </div>
                            </div>
                          </motion.li>
                        ))
                      ) : (
                        <motion.li
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="py-4"
                        >
                          <p className="text-sm text-gray-500">No upcoming deadlines found.</p>
                        </motion.li>
                      )}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8 bg-white shadow rounded-lg overflow-hidden"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-blue-500" />
              Recent Activity
            </h3>
            <div className="mt-6 flow-root">
              {activityLoading ? (
                <div className="animate-pulse space-y-8">
                  <div className="flex space-x-4">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="flex space-x-4">
                    <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="-mb-8">
                  <AnimatePresence>
                    {activities.length > 0 ? (
                      activities.map((activity, activityIdx) => (
                        <motion.li 
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: activityIdx * 0.1 }}
                        >
                          <div className="relative pb-8">
                            {activityIdx !== activities.length - 1 ? (
                              <span className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                            ) : null}
                            <div className="relative flex items-start space-x-3">
                              <div className="relative">
                                {activity.userImage ? (
                                  <Image 
                                    className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center ring-8 ring-white"
                                    src={activity.userImage}
                                    alt={activity.user}
                                    width={40}
                                    height={40}
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center ring-8 ring-white">
                                    <span className="text-xs font-medium text-gray-500">
                                      {activity.user.split(' ').map(n => n[0]).join('')}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div>
                                  <div className="text-sm">
                                    <span className="font-medium text-gray-900">{activity.user}</span>
                                    <span className="text-gray-500"> {activity.action} in </span>
                                    {activity.projectId ? (
                                      <Link href={`/project/${activity.projectId}`} className="font-medium text-gray-900 hover:text-blue-600">
                                        {activity.project}
                                      </Link>
                                    ) : (
                                      <span className="font-medium text-gray-900">{activity.project}</span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-sm text-gray-500">
                                    {activity.time}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ))
                    ) : (
                      <motion.li
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <p className="text-sm text-gray-500 mt-4">No recent activity found.</p>
                      </motion.li>
                    )}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </div>
        </motion.div>
        
        {}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 bg-white shadow rounded-lg overflow-hidden"
        >
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <FireIcon className="h-5 w-5 mr-2 text-orange-500" />
              Hot Projects
            </h3>
            <div className="mt-6 flow-root">
              {projectsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-gray-200 rounded w-full"></div>
                  <div className="h-20 bg-gray-200 rounded w-full"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {projects && projects.length > 0 ? (
                      [...projects]
                        .sort((a, b) => ((b.completionPercentage ?? 0) - (a.completionPercentage ?? 0)))
                        .slice(0, 4)
                        .map((project, index) => (
                          <motion.div
                            key={project.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                          >
                            <Link href={`/project/${project.id}`} className="block">
                              <h4 className="font-medium text-gray-900">{project.name}</h4>
                              <div className="mt-2 flex items-center justify-between">
                                <div className="flex items-center text-sm text-gray-500">
                                  <FlagIcon className="h-4 w-4 mr-1" />
                                  <span>{project.milestones?.length ?? 0} milestones</span>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                                  <span>{project.completedTasksCount ?? 0}/{project.totalTasks ?? 0} tasks</span>
                                </div>
                              </div>
                              <div className="mt-3">
                                <div className="relative pt-1">
                                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${project.completionPercentage ?? 0}%` }}
                                      transition={{ duration: 1, delay: 0.5 + index * 0.2 }}
                                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                                    ></motion.div>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </motion.div>
                        ))
                    ) : (
                      <div className="col-span-2 text-center py-4">
                        <p className="text-gray-500">No projects found.</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
