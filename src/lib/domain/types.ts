/**
 * DapUp domain model (milestone 2).
 *
 * These types are backend-agnostic. They are consumed by the mock
 * repositories today and are intended to survive the later swap to a real
 * backend unchanged.
 */

export type AccountType = "student" | "mentor";

/**
 * Admin is a capability, not an account type. A user may be a mentor with
 * admin capability, but admin-only UI must check `isAdmin` explicitly and
 * never infer it from `accountType`.
 */
export type UserCapabilities = {
  isAdmin: boolean;
};

export type EducationSystem = "AP" | "IB" | "A Levels";

export type ServiceType =
  | "Essay review"
  | "Application strategy"
  | "Subject tutoring"
  | "Interview prep"
  | "Portfolio review";

/** Public mentor data. Deliberately contains no pricing information. */
export type Mentor = {
  id: string;
  slug: string;
  name: string;
  university: string;
  major: string;
  countryRegion: string;
  biography: string;
  services: ServiceType[];
  subjects: string[];
  educationSystems: EducationSystem[];
};

/**
 * Private mentor profile. `privatePriceUsd` must only ever be shown to the
 * mentor themselves, a student with an accepted connection to that mentor,
 * or a user with explicit admin capability.
 */
export type MentorProfile = Mentor & {
  privatePriceUsd: number;
};

export type StudentProfile = {
  id: string;
  fullName: string;
  school: string;
  yearLevel: string;
  educationSystem: EducationSystem | null;
  subjects: string[];
  biography: string;
};

/** Fields a student must fill in before sending connection requests. */
export const STUDENT_PROFILE_REQUIRED_FIELDS = [
  "fullName",
  "school",
  "yearLevel",
  "educationSystem",
] as const;

export function isStudentProfileComplete(profile: StudentProfile): boolean {
  return (
    profile.fullName.trim().length > 0 &&
    profile.school.trim().length > 0 &&
    profile.yearLevel.trim().length > 0 &&
    profile.educationSystem !== null
  );
}

/**
 * Connection lifecycle. There is deliberately no rejected state: mentors may
 * accept a request or archive it for themselves, never reject it.
 */
export type ConnectionState =
  | "pending"
  | "accepted"
  | "disconnected"
  | "blocked";

/** Mentor-side view state. Archiving is not part of the lifecycle and is never shown to the student. */
export type MentorRequestViewState = {
  archivedByMentor: boolean;
};

export type ConnectionPurpose =
  | "Essay review"
  | "Application advice"
  | "Subject help"
  | "General mentorship";

export type ConnectionRequest = {
  id: string;
  mentorId: string;
  studentId: string;
  purpose: ConnectionPurpose;
  message: string;
  state: ConnectionState;
  archivedByMentor: boolean;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
};

/** An accepted request. Same record, narrowed state. */
export type Connection = ConnectionRequest & { state: "accepted" };

export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  sentAt: string; // ISO timestamp
};

export type MessageThread = {
  id: string;
  /** The request/connection this thread belongs to. Threads exist only after acceptance. */
  connectionId: string;
  mentorId: string;
  studentId: string;
  /** ISO timestamp of each participant's last read, keyed by user id. */
  lastReadAt: Record<string, string>;
};

export type MentorFilters = {
  /** Free-text search over name, university, major/expertise, and subjects. */
  query?: string;
  educationSystem?: EducationSystem;
  subject?: string;
  countryRegion?: string;
  university?: string;
  serviceType?: ServiceType;
};

export type CreateConnectionRequestInput = {
  mentorId: string;
  studentId: string;
  purpose: ConnectionPurpose;
  message: string;
};

export type UpdateMentorProfileInput = {
  mentorId: string;
  name?: string;
  university?: string;
  major?: string;
  countryRegion?: string;
  biography?: string;
  services?: ServiceType[];
  subjects?: string[];
  educationSystems?: EducationSystem[];
  privatePriceUsd?: number;
};

export type UpdateStudentProfileInput = {
  studentId: string;
  fullName?: string;
  school?: string;
  yearLevel?: string;
  educationSystem?: EducationSystem | null;
  subjects?: string[];
  biography?: string;
};

/**
 * Typed navigation intent: what a visitor or incomplete-profile student was
 * trying to do, preserved across the auth/profile-setup detour.
 */
export type ConnectionIntent = {
  kind: "connect-with-mentor";
  mentorSlug: string;
  returnTo: string;
};

export const EDUCATION_SYSTEMS: EducationSystem[] = ["AP", "IB", "A Levels"];

export const SERVICE_TYPES: ServiceType[] = [
  "Essay review",
  "Application strategy",
  "Subject tutoring",
  "Interview prep",
  "Portfolio review",
];

export const CONNECTION_PURPOSES: ConnectionPurpose[] = [
  "Essay review",
  "Application advice",
  "Subject help",
  "General mentorship",
];
