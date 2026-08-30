/**
 * Deterministic MOCK seed data for the milestone 2 functional prototype.
 *
 * Everything in this file is fictional demo content. It is the initial state
 * of the browser-local mock store and will be replaced by a real backend in
 * a later milestone.
 */

import type {
  ConnectionRequest,
  MentorProfile,
  Message,
  MessageThread,
  StudentProfile,
} from "@/lib/domain/types";

/** Fixed identity ids used by tests and optional mentorProfileId mappings. */
export const DEMO_STUDENT_ID = "student-demo";
export const DEMO_MENTOR_ID = "mentor-jae";
export const DEMO_ADMIN_MENTOR_ID = "mentor-mira";

export const SEED_MENTOR_PROFILES: MentorProfile[] = [
  {
    id: "mentor-jae",
    slug: "jae-park",
    name: "Jae Park",
    university: "Stanford University",
    major: "Computer Science",
    countryRegion: "United States",
    biography:
      "Went through the US application cycle with the IB diploma and now mentor students aiming for competitive CS programs. I focus on honest, practical feedback on essays and activity lists.",
    services: ["Essay review", "Application strategy", "Interview prep"],
    subjects: ["Computer Science", "Mathematics", "Physics"],
    educationSystems: ["IB", "AP"],
    privatePriceUsd: 40,
  },
  {
    id: "mentor-mira",
    slug: "mira-chen",
    name: "Mira Chen",
    university: "University of Cambridge",
    major: "Natural Sciences",
    countryRegion: "United Kingdom",
    biography:
      "A Levels survivor and Cambridge Natural Sciences student. I help students prepare for UK applications, personal statements, and science admissions interviews.",
    services: ["Application strategy", "Interview prep", "Subject tutoring"],
    subjects: ["Chemistry", "Biology", "Mathematics"],
    educationSystems: ["A Levels", "IB"],
    privatePriceUsd: 35,
  },
  {
    id: "mentor-tomas",
    slug: "tomas-alvarez",
    name: "Tomás Álvarez",
    university: "University of Toronto",
    major: "Economics",
    countryRegion: "Canada",
    biography:
      "IB graduate mentoring students on economics, extended essays, and applying to Canadian universities as an international student.",
    services: ["Essay review", "Subject tutoring"],
    subjects: ["Economics", "Business", "Mathematics"],
    educationSystems: ["IB"],
    privatePriceUsd: 25,
  },
  {
    id: "mentor-ana",
    slug: "ana-silva",
    name: "Ana Silva",
    university: "University of Auckland",
    major: "Law",
    countryRegion: "New Zealand",
    biography:
      "NCEA and A Levels background. I mentor students on humanities essays, scholarship applications, and finding the right fit in Australasia.",
    services: ["Essay review", "Application strategy"],
    subjects: ["English", "History", "Law"],
    educationSystems: ["A Levels"],
    privatePriceUsd: 20,
  },
  {
    id: "mentor-daniel",
    slug: "daniel-okafor",
    name: "Daniel Okafor",
    university: "MIT",
    major: "Mechanical Engineering",
    countryRegion: "United States",
    biography:
      "AP student turned MIT engineer. I review maker portfolios, help with STEM extracurricular strategy, and tutor physics and calculus.",
    services: ["Portfolio review", "Subject tutoring", "Essay review"],
    subjects: ["Physics", "Mathematics", "Engineering"],
    educationSystems: ["AP"],
    privatePriceUsd: 45,
  },
  {
    id: "mentor-hana",
    slug: "hana-sato",
    name: "Hana Sato",
    university: "University of Melbourne",
    major: "Medicine",
    countryRegion: "Australia",
    biography:
      "IB graduate now in medicine. I mentor students through UCAT preparation mindset, interviews, and choosing between medical pathways.",
    services: ["Interview prep", "Application strategy"],
    subjects: ["Biology", "Chemistry"],
    educationSystems: ["IB", "A Levels"],
    privatePriceUsd: 30,
  },
  {
    id: "mentor-lucas",
    slug: "lucas-meyer",
    name: "Lucas Meyer",
    university: "ETH Zürich",
    major: "Mathematics",
    countryRegion: "Switzerland",
    biography:
      "A Levels background with a love for olympiad mathematics. I tutor advanced maths and help students present technical projects well.",
    services: ["Subject tutoring", "Portfolio review"],
    subjects: ["Mathematics", "Computer Science"],
    educationSystems: ["A Levels", "AP"],
    privatePriceUsd: 28,
  },
  {
    id: "mentor-priya",
    slug: "priya-nair",
    name: "Priya Nair",
    university: "National University of Singapore",
    major: "Business Administration",
    countryRegion: "Singapore",
    biography:
      "AP and IB experience across two school systems. I help students tell a coherent story across essays, activities, and interviews.",
    services: ["Essay review", "Application strategy", "Interview prep"],
    subjects: ["Business", "Economics", "English"],
    educationSystems: ["AP", "IB"],
    privatePriceUsd: 32,
  },
];

export const SEED_STUDENT_PROFILES: StudentProfile[] = [
  {
    // The demo student starts with an intentionally incomplete profile so the
    // profile-setup gate in the connect journey can be exercised.
    id: DEMO_STUDENT_ID,
    fullName: "",
    school: "",
    yearLevel: "",
    educationSystem: null,
    subjects: [],
    biography: "",
  },
  {
    id: "student-noah",
    fullName: "Noah Williams",
    school: "Auckland Grammar School",
    yearLevel: "Year 13",
    educationSystem: "A Levels",
    subjects: ["Physics", "Mathematics"],
    biography: "Aiming for engineering in the US or Canada.",
  },
  {
    id: "student-lily",
    fullName: "Lily Zhang",
    school: "Ridgeview High School",
    yearLevel: "Grade 12",
    educationSystem: "AP",
    subjects: ["Computer Science", "Mathematics"],
    biography: "Interested in CS and startups.",
  },
  {
    id: "student-omar",
    fullName: "Omar Haddad",
    school: "International School of Geneva",
    yearLevel: "DP2",
    educationSystem: "IB",
    subjects: ["Economics", "English"],
    biography: "Working on my extended essay in economics.",
  },
];

/**
 * Seeded requests give the demo mentor a realistic inbox:
 * two pending requests and one accepted connection with an active thread.
 */
export const SEED_CONNECTION_REQUESTS: ConnectionRequest[] = [
  {
    id: "request-noah-jae",
    mentorId: "mentor-jae",
    studentId: "student-noah",
    purpose: "Application advice",
    message:
      "Hi Jae — I'm deciding between applying to US and Canadian engineering programs and would love your take on how to position my robotics work.",
    state: "pending",
    archivedByMentor: false,
    createdAt: "2026-08-18T09:30:00.000Z",
    updatedAt: "2026-08-18T09:30:00.000Z",
  },
  {
    id: "request-omar-jae",
    mentorId: "mentor-jae",
    studentId: "student-omar",
    purpose: "Essay review",
    message:
      "Hello! Could you review the outline of my economics extended essay? I want to make sure my research question is focused enough.",
    state: "pending",
    archivedByMentor: false,
    createdAt: "2026-08-20T14:05:00.000Z",
    updatedAt: "2026-08-20T14:05:00.000Z",
  },
  {
    id: "request-lily-jae",
    mentorId: "mentor-jae",
    studentId: "student-lily",
    purpose: "Subject help",
    message:
      "Hi! I'm taking AP CS A and building a small app on the side. Could you mentor me on both the course and the project?",
    state: "accepted",
    archivedByMentor: false,
    createdAt: "2026-08-10T11:00:00.000Z",
    updatedAt: "2026-08-12T08:15:00.000Z",
  },
  {
    id: "request-omar-mira",
    mentorId: "mentor-mira",
    studentId: "student-omar",
    purpose: "Application advice",
    message:
      "Hi Mira — I'm considering Natural Sciences at Cambridge and would love advice on the personal statement.",
    state: "pending",
    archivedByMentor: false,
    createdAt: "2026-08-21T10:00:00.000Z",
    updatedAt: "2026-08-21T10:00:00.000Z",
  },
];

export const SEED_THREADS: MessageThread[] = [
  {
    id: "thread-lily-jae",
    connectionId: "request-lily-jae",
    mentorId: "mentor-jae",
    studentId: "student-lily",
    lastReadAt: {
      "student-lily": "2026-08-15T09:00:00.000Z",
      "mentor-jae": "2026-08-14T10:00:00.000Z",
    },
  },
];

export const SEED_MESSAGES: Message[] = [
  {
    id: "message-1",
    threadId: "thread-lily-jae",
    senderId: "student-lily",
    text: "Thanks for accepting! When would suit you for a first chat about my app project?",
    sentAt: "2026-08-12T09:00:00.000Z",
  },
  {
    id: "message-2",
    threadId: "thread-lily-jae",
    senderId: "mentor-jae",
    text: "Welcome aboard, Lily. Send over your project repo or a short description and we'll take it from there.",
    sentAt: "2026-08-13T10:30:00.000Z",
  },
  {
    id: "message-3",
    threadId: "thread-lily-jae",
    senderId: "student-lily",
    text: "Just sent a summary — it's a study-planner app for AP students. Excited to hear what you think!",
    sentAt: "2026-08-15T08:45:00.000Z",
  },
];
