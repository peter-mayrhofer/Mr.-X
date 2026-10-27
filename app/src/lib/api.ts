// Aufrufe an den Spiel-Server mit gemeinsamen Typen (shared/api.ts); Ablehnungen als ApiError mit Grund.
import { httpsCallable, type FunctionsError } from "firebase/functions";
import type { ApiReason, ApiRequest, ApiResults } from "@mrx/shared";
import { functions } from "./firebase.ts";

export class ApiError extends Error {
  constructor(
    readonly reason: ApiReason | "network",
    message: string,
  ) {
    super(message);
  }
}

const fn = httpsCallable(functions, "api");

export async function call<R extends ApiRequest>(req: R): Promise<ApiResults[R["action"]]> {
  try {
    return (await fn(req)).data as ApiResults[R["action"]];
  } catch (e) {
    const err = e as FunctionsError;
    const reason = (err.details as { reason?: ApiReason } | undefined)?.reason;
    throw new ApiError(reason ?? "network", err.message);
  }
}
