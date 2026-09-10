import { Types } from "mongoose";
import { ActivityModel, UserModel, type Activity, type User } from "../../model/index";

export const TEST_USER_ID_HEX = "000000000000000000000001";
export const TEST_USER_ID = new Types.ObjectId(TEST_USER_ID_HEX);
export const OTHER_USER_ID_HEX = "000000000000000000000002";
export const OTHER_USER_ID = new Types.ObjectId(OTHER_USER_ID_HEX);
export const TEST_TIMEZONE = "Asia/Kolkata";
export const FROZEN_TIME_ISO = "2026-09-09T08:00:00+05:30";

export const TEST_GOOGLE_PROFILE = {
  googleId: "google-test-001",
  email: "user_test_001@gmail.com",
  name: "Test User",
  picture: "https://example.com/avatar.png",
};

export async function seedTestUser(): Promise<User> {
  return UserModel.create({
    _id: TEST_USER_ID,
    googleId: TEST_GOOGLE_PROFILE.googleId,
    email: TEST_GOOGLE_PROFILE.email,
    name: TEST_GOOGLE_PROFILE.name,
    picture: TEST_GOOGLE_PROFILE.picture,
    timezone: TEST_TIMEZONE,
  });
}

export type SeededActivities = {
  dellMeeting: Activity;
  lunch: Activity;
  gym: Activity;
  dinner: Activity;
  vitaminD: Activity;
};

export async function seedDatabase(userId: Types.ObjectId = TEST_USER_ID): Promise<SeededActivities> {
  await seedTestUser();
  const dellMeeting = await ActivityModel.create({
    userId,
    title: "Dell Meeting",
    note: "Quarterly review",
    category: "work",
    schedule: {
      startAt: new Date("2026-09-09T10:00:00+05:30"),
      endAt: new Date("2026-09-09T11:00:00+05:30"),
      durationMin: 60,
      timezone: TEST_TIMEZONE,
    },
    behavior: {
      flexibility: "fixed",
      recurrence: { rule: "none", interval: 1, days: [], until: null },
    },
    priority: 5,
    reminders: [{ beforeMin: 15 }],
    status: "pending",
    tags: ["work", "meeting"],
    metadata: {},
    createdBy: "user",
  });

  const lunch = await ActivityModel.create({
    userId,
    title: "Lunch",
    note: "Team lunch",
    category: "personal",
    schedule: {
      startAt: new Date("2026-09-09T13:00:00+05:30"),
      endAt: new Date("2026-09-09T14:00:00+05:30"),
      durationMin: 60,
      timezone: TEST_TIMEZONE,
    },
    behavior: {
      flexibility: "fixed",
      recurrence: { rule: "none", interval: 1, days: [], until: null },
    },
    priority: 4,
    reminders: [],
    status: "pending",
    tags: ["food"],
    metadata: {},
    createdBy: "user",
  });

  const gym = await ActivityModel.create({
    userId,
    title: "Gym",
    note: "Leg day",
    category: "health",
    schedule: {
      startAt: new Date("2026-09-09T18:00:00+05:30"),
      endAt: new Date("2026-09-09T19:00:00+05:30"),
      durationMin: 60,
      timezone: TEST_TIMEZONE,
    },
    behavior: {
      flexibility: "moveable",
      recurrence: { rule: "none", interval: 1, days: [], until: null },
    },
    priority: 3,
    reminders: [{ beforeMin: 30 }],
    status: "pending",
    tags: ["fitness"],
    metadata: {},
    createdBy: "user",
  });

  const dinner = await ActivityModel.create({
    userId,
    title: "Dinner",
    note: "Family dinner",
    category: "personal",
    schedule: {
      startAt: new Date("2026-09-09T20:30:00+05:30"),
      endAt: new Date("2026-09-09T21:30:00+05:30"),
      durationMin: 60,
      timezone: TEST_TIMEZONE,
    },
    behavior: {
      flexibility: "moveable",
      recurrence: { rule: "daily", interval: 1, days: [], until: null },
    },
    priority: 5,
    reminders: [{ beforeMin: 10 }],
    status: "pending",
    tags: ["family"],
    metadata: {},
    createdBy: "ai",
  });

  const vitaminD = await ActivityModel.create({
    userId,
    title: "Vitamin D",
    note: "Take supplement",
    category: "health",
    schedule: {
      startAt: new Date("2026-09-09T22:45:00+05:30"),
      endAt: new Date("2026-09-09T23:00:00+05:30"),
      durationMin: 15,
      timezone: TEST_TIMEZONE,
    },
    behavior: {
      flexibility: "moveable",
      recurrence: { rule: "weekly", interval: 1, days: [3], until: null },
    },
    priority: 2,
    reminders: [{ beforeMin: 5 }],
    status: "pending",
    tags: ["medicine"],
    metadata: {},
    createdBy: "user",
  });

  return { dellMeeting, lunch, gym, dinner, vitaminD };
}
