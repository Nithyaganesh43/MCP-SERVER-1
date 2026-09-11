import { Schema, model, type Model } from "mongoose";
import {
  COLLECTION_SCHEDULING_PREFERENCES,
  INDEXES_SCHEDULING_PREFERENCES,
  PREFERENCE_TYPE,
} from "./constants";
import {
  isValidPreferenceValue,
  type SchedulingPreference,
} from "./scheduling-preference.types";

export const SchedulingPreferenceSchema = new Schema<SchedulingPreference>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      required: true,
      enum: PREFERENCE_TYPE,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function (this: SchedulingPreference, value: unknown) {
          return isValidPreferenceValue(this.type, value);
        },
        message: "value does not match preference type",
      },
    },
    timezone: { type: String, required: true },
  },
  {
    collection: COLLECTION_SCHEDULING_PREFERENCES,
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

for (const index of INDEXES_SCHEDULING_PREFERENCES) {
  SchedulingPreferenceSchema.index({ ...index }, { unique: true });
}

export const SchedulingPreferenceModel: Model<SchedulingPreference> =
  model<SchedulingPreference>(
    "SchedulingPreference",
    SchedulingPreferenceSchema,
  );
