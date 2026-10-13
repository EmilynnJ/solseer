import type { AuthenticatedUser } from "@soulseer/shared";

export type AuthIdentity = {
  subject: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
};

export type AppVariables = {
  requestId: string;
  identity: AuthIdentity;
  user: AuthenticatedUser;
};

export type AppBindings = { Bindings: Env; Variables: AppVariables };
