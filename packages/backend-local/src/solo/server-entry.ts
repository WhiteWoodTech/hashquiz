// Server-only entry (`@quizv/backend-local/solo-server`): pulls in `bun:sqlite`.
export { SoloStore, DEFAULT_SOLO_DB } from './store'
export { createSoloHttpHandler, SoloPresenceHub, SOLO_MAX_BODY, type SoloServiceOptions, type SoloConn } from './server'
export { SOLO_WS_ROLE, soloTopic, type SoloClientMsg, type SoloServerMsg } from './protocol'
