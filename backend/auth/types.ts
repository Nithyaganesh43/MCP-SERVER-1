export interface UserView {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  timezone: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenResponse {
  token: string;
  user: UserView;
}
