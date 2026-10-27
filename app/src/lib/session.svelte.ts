// Wer bin ich, in welchem Spiel, mit welcher Rolle? Live aus Auth + Datenbank (userGames, members, info).
// Wird ein Gerät entfernt (Admin, neue Runde), setzt der Server userGames/{uid}.removedFrom –
// die App erklärt es dann freundlich (Screen 23).
import { GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, type User } from "firebase/auth";
import { onValue, ref, type Unsubscribe } from "firebase/database";
import type { GameInfo, Member, Role } from "@mrx/shared";
import { auth, db } from "./firebase.ts";
import { call } from "./api.ts";

class Session {
  user = $state<User | null>(null);
  ready = $state(false);
  superAdmin = $state(false);
  gameId = $state<string | null>(null);
  role = $state<Role | null>(null);
  member = $state<Member | null>(null);
  info = $state<GameInfo | null>(null);
  /** Gerät wurde aus dem Spiel entfernt (oder neue Runde) */
  removed = $state(false);
}

export const session = new Session();

const subs: Unsubscribe[] = [];
const gameSubs: Unsubscribe[] = [];
const stop = (list: Unsubscribe[]) => list.splice(0).forEach((u) => u());

function watchGame(gameId: string | null, uid: string) {
  stop(gameSubs);
  session.member = null;
  session.info = null;
  if (!gameId) return;
  gameSubs.push(
    onValue(ref(db, `games/${gameId}/members/${uid}`), (s) => (session.member = s.val() as Member | null)),
    onValue(
      ref(db, `games/${gameId}/info`),
      (s) => (session.info = s.val() as GameInfo | null),
      () => (session.info = null),
    ),
  );
}

onAuthStateChanged(auth, async (u) => {
  stop(subs);
  stop(gameSubs);
  session.user = u;
  session.superAdmin = u ? (await u.getIdTokenResult()).claims.superAdmin === true : false;
  if (!u) {
    session.gameId = session.role = null;
    session.ready = true;
    return;
  }
  subs.push(
    onValue(ref(db, `userGames/${u.uid}`), (s) => {
      const v = s.val() as { gameId?: string; role?: Role; removedFrom?: string } | null;
      const gameId = v?.gameId ?? null;
      if (gameId !== session.gameId) watchGame(gameId, u.uid);
      session.gameId = gameId;
      session.role = v?.role ?? null;
      session.removed = !!v?.removedFrom;
      session.ready = true;
    }),
  );
});

/** Teams/Schiris/Spielleitung brauchen kein Konto mit E-Mail: anonymes Konto pro Gerät (E-05) */
export async function ensureDevice(): Promise<User> {
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

/** Organisator: Google-Login, dann prüft der Server die Freigabeliste und setzt den Claim */
export async function signInSuperAdmin(): Promise<boolean> {
  const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
  const { superAdmin } = await call({ action: "claimSuperAdmin" });
  await user.getIdToken(true);
  session.superAdmin = superAdmin;
  return superAdmin;
}

/** Abmelden (oder nach einer Entfernung den Hinweis quittieren) */
export async function leaveGame() {
  await call({ action: "leave", gameId: session.gameId ?? "" });
}

export async function signOutCompletely() {
  await leaveGame().catch(() => {});
  await signOut(auth);
}
