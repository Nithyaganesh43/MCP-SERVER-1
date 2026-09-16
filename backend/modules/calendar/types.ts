export interface CalendarModuleTypes {
  activityId?: string;
  title?: string;
  schedule?: {
    startAt?: string | null;
    endAt?: string | null;
    durationMin?: number | null;
    timezone?: string;
  };
}
