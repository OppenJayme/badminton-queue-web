import { atomWithStorage } from "jotai/utils";
import type { SessionDetail } from "../types/session";
import type { QueueDetails } from "../types/queue";

type SessionCache = Record<number, { detail: SessionDetail; fetchedAt: number }>;
type QueueCache = Record<number, { queue: QueueDetails; fetchedAt: number }>;
type LastQueueBySession = Record<number, number>;
type LastQueueId = number | null;
type CacheUser = number | null;

// Persist small caches across navigation so we can hydrate instantly.
export const sessionCacheAtom = atomWithStorage<SessionCache>("bq_session_cache", {});
export const queueCacheAtom = atomWithStorage<QueueCache>("bq_queue_cache", {});
export const lastQueueBySessionAtom = atomWithStorage<LastQueueBySession>("bq_last_queue_by_session", {});
export const lastQueueIdAtom = atomWithStorage<LastQueueId>("bq_last_queue_id", null);
export const cacheUserAtom = atomWithStorage<CacheUser>("bq_cache_user", null);
