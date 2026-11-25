import { apiRequest } from "./queryClient";
import type { Task, InsertTask, Candidate, InsertCandidate, User, PublicTutor } from "@shared/schema";

export const api = {
  // Users
  getCurrentUser: async (): Promise<User> => {
    const response = await apiRequest("GET", "/api/user/current");
    return response.json();
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    const response = await apiRequest("GET", "/api/tasks");
    return response.json();
  },

  createTask: async (task: InsertTask & { userId: string }): Promise<Task> => {
    const response = await apiRequest("POST", "/api/tasks", task);
    return response.json();
  },

  updateTask: async (id: string, updates: Partial<Task>): Promise<Task> => {
    const response = await apiRequest("PATCH", `/api/tasks/${id}`, updates);
    return response.json();
  },

  // Tutors
  getTutors: async (): Promise<PublicTutor[]> => {
    const response = await apiRequest("GET", "/api/tutors");
    return response.json();
  },

  // Candidates
  createCandidate: async (candidate: InsertCandidate): Promise<Candidate> => {
    const response = await apiRequest("POST", "/api/candidates", candidate);
    return response.json();
  },
};
