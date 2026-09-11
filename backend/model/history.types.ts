import type { Types } from "mongoose";
import type { Activity } from "./activity.types";

export type HistoryAction = "create" | "update" | "delete" | "complete" | "reschedule";

export interface ActivityHistory {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  activityId: Types.ObjectId;
  action: HistoryAction;
  previousState: Activity | null;
  newState: Activity | null;
  createdAt: Date;
}
