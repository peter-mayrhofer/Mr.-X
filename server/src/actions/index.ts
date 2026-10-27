// Alle Aktionen des Spielraums (POST /api mit gameId). Organisator-Login und Spieleliste erledigt der Worker selbst.
import type { ApiRequest } from "@mrx/shared";
import type { Auth, GameRoom } from "../room.ts";
import { createGame, gameInfo, join, leave, screenLink, setSecret } from "./access.ts";
import * as spiel from "./spiel.ts";
import { handover, undo } from "./uebergabe.ts";
import { removeMember, removeTeam, renameTeam, resetRound } from "./runde.ts";
import { archiveGame, deleteGame, setField } from "./feld.ts";
import { archiveGet, archiveList, chat, deleteChat, pushSubscribe } from "./chat.ts";
import { addDevice, deviceKey, removeDevice, setDevice } from "./geraete.ts";

type Action = (room: GameRoom, d: Record<string, unknown>, a: Auth) => unknown;

export const ACTIONS: Partial<Record<ApiRequest["action"], Action>> = {
  createGame,
  gameInfo,
  join,
  leave,
  setSecret,
  screenLink,
  ...spiel,
  handover,
  undo,
  resetRound,
  removeMember,
  removeTeam,
  renameTeam,
  setField,
  archiveGame,
  deleteGame,
  chat,
  deleteChat,
  pushSubscribe,
  archiveList,
  archiveGet,
  addDevice,
  setDevice,
  removeDevice,
  deviceKey,
};
