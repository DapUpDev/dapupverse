/**
 * ConnectionRepository over the DapUp API.
 *
 * The API identifies the caller from the session token, so the ids the UI
 * passes for "whose list" are ignored: `listForStudent` and
 * `listForMentor` are both "my connections". The API's error codes map
 * onto the error classes the UI already handles.
 */

import { ApiError, apiFetch } from "@/lib/api/client";
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

    async listForStudent(): Promise<ConnectionRequest[]> {
      return apiFetch<ConnectionRequest[]>("/connections");
    },

    async listForMentor(): Promise<ConnectionRequest[]> {
      return apiFetch<ConnectionRequest[]>("/connections");
    },

    async get(id: string): Promise<ConnectionRequest | null> {
      try {
        return await apiFetch<ConnectionRequest>(`/connections/${encodeURIComponent(id)}`);
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return null;
        throw error;
      }
    },

    async findActiveForPair(_studentId: string, mentorId: string): Promise<ConnectionRequest | null> {
      try {
        return await apiFetch<ConnectionRequest>("/connections/active", { query: { mentorId } });
      } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return null;
        throw error;
      }
    },
  };
}
