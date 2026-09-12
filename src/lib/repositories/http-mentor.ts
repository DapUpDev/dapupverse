/**
 * MentorRepository over the DapUp API.
 *
 * Same interface the UI already depends on; only the transport changed.
 * The API decides who may see the private profile (the mentor themself or
 * an admin), so this adapter turns "not allowed" and "not found" into null
 * rather than errors: the UI treats both as "nothing to show".
 */

import { ApiError, apiFetch } from "@/lib/api/client";
import type {
  Mentor,
  MentorFilters,
  MentorProfile,
  UpdateMentorProfileInput,
} from "@/lib/domain/types";
import { notifyRepositoryChange } from "@/lib/repositories/change-signal";
import type { MentorRepository } from "@/lib/repositories/types";

/** The API serialises the decimal price as a string ("40.00"). */
type MentorPrivateWire = Omit<MentorProfile, "privatePriceUsd"> & {
  privatePriceUsd: string | number;
};

function toProfile(wire: MentorPrivateWire): MentorProfile {
  return { ...wire, privatePriceUsd: Number(wire.privatePriceUsd) };
}

function nullOn(statuses: number[], error: unknown): null {
  if (error instanceof ApiError && statuses.includes(error.status)) return null;
  throw error;
}

export function createHttpMentorRepository(): MentorRepository {
  return {
    async list(filters: MentorFilters = {}): Promise<Mentor[]> {
      return apiFetch<Mentor[]>("/mentors", {
        query: {
          query: filters.query,
          educationSystem: filters.educationSystem,
          subject: filters.subject,
          countryRegion: filters.countryRegion,
          university: filters.university,
          serviceType: filters.serviceType,
        },
      });
    },

    async getBySlug(slug: string): Promise<Mentor | null> {
      try {
        return await apiFetch<Mentor>(`/mentors/${encodeURIComponent(slug)}`);
      } catch (error) {
        return nullOn([404], error);
      }
    },

    async getPrivateProfile(mentorId: string): Promise<MentorProfile | null> {
      try {
        return toProfile(
          await apiFetch<MentorPrivateWire>(
            `/mentors/${encodeURIComponent(mentorId)}/private`,
          ),
        );
      } catch (error) {
        return nullOn([401, 403, 404], error);
      }
    },

    async updateProfile(input: UpdateMentorProfileInput): Promise<MentorProfile> {
      // The API identifies the mentor from the session token, never from
      // the body, so a client cannot edit another mentor's profile.
      const { mentorId, ...changes } = input;
      void mentorId;
      const profile = toProfile(
        await apiFetch<MentorPrivateWire>("/me/mentor-profile", {
          method: "PUT",
          body: changes,
        }),
      );
      notifyRepositoryChange();
      return profile;
    },

    async ensureProfile(): Promise<MentorProfile> {
      try {
        return toProfile(await apiFetch<MentorPrivateWire>("/me/mentor-profile"));
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
      const created = toProfile(
        await apiFetch<MentorPrivateWire>("/me/mentor-profile", {
          method: "PUT",
          body: {},
        }),
      );
      notifyRepositoryChange();
      return created;
    },
  };
}
