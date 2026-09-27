/**
 * ConnectionRepository over the DapUp API.
 *
 * The API identifies the caller from the session token and returns every
 * request the caller is party to, on either side. `listForStudent` and
 * `listForMentor` keep only the side the UI asked for, like the mock does:
 * a user who is both must not see their own outgoing requests as a mentor.
 * The API's error codes map onto the error classes the UI already handles.
 */

import { ApiError, apiFetch, nullOn } from "@/lib/api/client";
import type {
  Connection,
  ConnectionRequest,
  CreateConnectionRequestInput,
} from "@/lib/domain/types";
import { notifyRepositoryChange } from "@/lib/repositories/change-signal";
import {
  BlockedPairError,
  DuplicateRequestError,
  type ConnectionRepository,
} from "@/lib/repositories/types";

async function post<T>(path: string, body?: unknown): Promise<T> {
  const result = await apiFetch<T>(path, { method: "POST", body });
  notifyRepositoryChange();
  return result;
}

export function createHttpConnectionRepository(): ConnectionRepository {
  return {
    async createRequest(input: CreateConnectionRequestInput): Promise<ConnectionRequest> {
      const { studentId, ...body } = input;
      void studentId;
      try {
        return await post<ConnectionRequest>("/connections", body);
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.code === "duplicate_request") throw new DuplicateRequestError();
          if (error.code === "blocked_pair") throw new BlockedPairError();
        }
        throw error;
      }
    },

    async acceptRequest(id: string): Promise<Connection> {
      return post<Connection>(`/connections/${encodeURIComponent(id)}/accept`);
    },

    async archiveForMentor(id: string): Promise<void> {
      await post(`/connections/${encodeURIComponent(id)}/archive`);
    },

    async unarchiveForMentor(id: string): Promise<void> {
      await post(`/connections/${encodeURIComponent(id)}/unarchive`);
    },

    async disconnect(connectionId: string): Promise<void> {
      await post(`/connections/${encodeURIComponent(connectionId)}/disconnect`);
    },

    async block(connectionId: string): Promise<void> {
      await post(`/connections/${encodeURIComponent(connectionId)}/block`);
    },

    async listForStudent(studentId: string): Promise<ConnectionRequest[]> {
      return (await apiFetch<ConnectionRequest[]>("/connections")).filter((r) => r.studentId === studentId);
    },

    async listForMentor(mentorId: string): Promise<ConnectionRequest[]> {
      return (await apiFetch<ConnectionRequest[]>("/connections")).filter((r) => r.mentorId === mentorId);
    },

    async get(id: string): Promise<ConnectionRequest | null> {
      try {
        return await apiFetch<ConnectionRequest>(`/connections/${encodeURIComponent(id)}`);
      } catch (error) {
        return nullOn([401, 403, 404], error);
      }
    },

    async findActiveForPair(_studentId: string, mentorId: string): Promise<ConnectionRequest | null> {
      try {
        return await apiFetch<ConnectionRequest>("/connections/active", { query: { mentorId } });
      } catch (error) {
        return nullOn([401, 403, 404], error);
      }
    },
  };
}
