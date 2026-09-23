import type { Config } from "../config";
import { HttpError } from "../shared/errors";
import { generateUserApiKey, UserModel, type User } from "../model/index";
import { exchangeGoogleCode, type GoogleProfile } from "./google";
import { signJwt } from "./jwt";
import type { AuthTokenResponse, UserView } from "./types";

export function toUserView(user: User): UserView {
  return {
    id: String(user._id),
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    timezone: user.timezone,
    apiKey: user.apiKey,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function ensureApiKey(user: User): Promise<User> {
  if (typeof user.apiKey === "string" && user.apiKey.length > 0) {
    return user;
  }
  const apiKey = generateUserApiKey();
  await UserModel.updateOne({ _id: user._id }, { $set: { apiKey } });
  user.apiKey = apiKey;
  return user;
}

export async function findOrCreateUser(
  profile: GoogleProfile,
  timezone: string,
): Promise<User> {
  const existing = await UserModel.findOne({
    $or: [{ googleId: profile.googleId }, { email: profile.email }],
  });
  if (existing) {
    if (existing.googleId !== profile.googleId) {
      existing.googleId = profile.googleId;
      await UserModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            googleId: profile.googleId,
            ...(profile.name ? { name: profile.name } : {}),
            ...(profile.picture ? { picture: profile.picture } : {}),
          },
        },
      );
    }
    return ensureApiKey(existing);
  }
  return UserModel.create({
    googleId: profile.googleId,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    timezone,
    apiKey: generateUserApiKey(),
  });
}

export async function loginFromGoogleCode(
  code: string,
  config: Config,
): Promise<AuthTokenResponse> {
  const profile = await exchangeGoogleCode(code, config);
  const user = await findOrCreateUser(profile, config.timezone);
  const token = signJwt(
    { sub: String(user._id), email: user.email, name: user.name },
    config.jwtSecret,
    config.jwtExpiresIn,
  );
  return { token, user: toUserView(user) };
}

export async function loginWithApiKey(
  apiKey: string,
  config: Config,
): Promise<AuthTokenResponse> {
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new HttpError(401, "Unauthorized");
  }
  const user = await UserModel.findOne({ apiKey: apiKey.trim() });
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  const token = signJwt(
    { sub: String(user._id), email: user.email, name: user.name },
    config.jwtSecret,
    config.jwtExpiresIn,
  );
  return { token, user: toUserView(user) };
}

export async function getUserProfile(userId: string): Promise<UserView> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HttpError(401, "Unauthorized");
  }
  const withKey = await ensureApiKey(user);
  return toUserView(withKey);
}

export async function regenerateApiKey(userId: string): Promise<UserView> {
  const newApiKey = generateUserApiKey();
  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { apiKey: newApiKey } },
    { new: true },
  );
  if (!updated) {
    throw new HttpError(401, "Unauthorized");
  }
  return toUserView(updated);
}
