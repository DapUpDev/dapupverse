/**
 * StudentProfileRepository over the DapUp API.
 *
 * The API knows who is asking from the session token, so `update` and
 * `ensure` ignore the id the UI passes and always act on the caller's own
 * profile. `get` may be called by the student, an admin, or a mentor
 * looking at a requester; "not allowed" and "not found" both become null.
 */

import { ApiError, apiFetch } from "@/lib/api/client";
import type { StudentProfile, UpdateStudentProfileInput } from "@/lib/domain/types";
import { notifyRepositoryChange } from "@/lib/repositories/change-signal";
import type { StudentProfileRepository } from "@/lib/repositories/types";

function nullOn(statuses: number[], error: unknown): null {
  if (error instanceof ApiError && statuses.includes(error.status)) return null;
  throw error;
}

export function createHttpStudentProfileRepository(): StudentProfileRepository {
  return {
    async get(studentId: string): Promise<StudentProfile | null> {
      try {
        return await apiFetch<StudentProfile>(
          `/students/${encodeURIComponent(studentId)}/profile`,
        );
      } catch (error) {
        return nullOn([401, 403, 404], error);
      }
    },

    async update(input: UpdateStudentProfileInput): Promise<StudentProfile> {
      const { studentId, ...changes } = input;
      void studentId;
      const profile = await apiFetch<StudentProfile>("/me/student-profile", {
        method: "PUT",
        body: changes,
      });
      notifyRepositoryChange();
      return profile;
    },

    async ensure(): Promise<StudentProfile> {
      try {
        return await apiFetch<StudentProfile>("/me/student-profile");
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
      const created = await apiFetch<StudentProfile>("/me/student-profile", {
        method: "PUT",
        body: {},
      });
      notifyRepositoryChange();
      return created;
    },
  };
}
